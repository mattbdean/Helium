import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

import { FieldConfig } from './field-config.interface';

@Component({
    selector: 'dynamic-form',
    template: `
        <form class="dynamic-form" [formGroup]="formGroup"
              (ngSubmit)="handleSubmit($event)">
            <ng-container *ngFor="let field of config" dynamicField
                          [config]="field" [group]="formGroup"></ng-container>
        </form>`
})
export class DynamicFormComponent implements OnChanges, OnInit {
    @Input()
    public config: FieldConfig[] = [];

    @Output()
    public submit: EventEmitter<any> = new EventEmitter<any>();

    public formGroup: FormGroup;

    public constructor(private fb: FormBuilder) {}

    /** All non-button controls */
    private get controls() { return this.config.filter(({ type }) => type !== 'submit'); }

    // Convenience getters for form properties
    private get value() { return this.formGroup.value; }

    public ngOnInit() {
        this.formGroup = this.createGroup();
    }

    public ngOnChanges() {
        if (this.formGroup) {
            const controls = Object.keys(this.formGroup.controls);
            const configControls = this.controls.map((item) => item.name);

            controls
                .filter((control) => !configControls.includes(control))
                .forEach((control) => this.formGroup.removeControl(control));

            configControls
                .filter((control) => !controls.includes(control))
                .forEach((name) => {
                    const conf = this.config.find((control) => control.name === name);
                    this.formGroup.addControl(name, this.createControl(conf));
                });
        }
    }

    public handleSubmit(event: Event) {
        // Prevent default actions and then send 
        event.preventDefault();
        event.stopPropagation();
        this.submit.emit(this.value);
    }

    private createGroup(): FormGroup {
        const group = this.fb.group({});
        this.config.forEach((c) => group.addControl(c.name, this.createControl(c)));
        return group;
    }

    private createControl(conf: FieldConfig): FormControl {
        const { disabled, validation, value } = conf;
        return this.fb.control({ disabled, value }, validation);
    }
}
