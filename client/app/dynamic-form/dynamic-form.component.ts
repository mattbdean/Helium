import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

import { FieldConfig } from './field-config.interface';

@Component({
    selector: 'dynamic-form',
    template: `
    <form class="dynamic-form" [formGroup]="form" (ngSubmit)="handleSubmit($event)">
        <ng-container *ngFor="let field of config" dynamicField [config]="field" [group]="form"></ng-container>
    </form>`
})
export class DynamicFormComponent implements OnChanges, OnInit {
    @Input()
    public config: FieldConfig[] = [];

    @Output()
    public submit: EventEmitter<any> = new EventEmitter<any>();

    public form: FormGroup;

    public constructor(private fb: FormBuilder) {}

    /** All non-button controls */
    private get controls() { return this.config.filter(({ type }) => type !== 'submit'); }

    // Convenience getters for form properties
    private get value() { return this.form.value; }

    public ngOnInit() {
        this.form = this.createGroup();
    }

    public ngOnChanges() {
        if (this.form) {
            const controls = Object.keys(this.form.controls);
            const configControls = this.controls.map((item) => item.name);

            controls
                .filter((control) => !configControls.includes(control))
                .forEach((control) => this.form.removeControl(control));

            configControls
                .filter((control) => !controls.includes(control))
                .forEach((name) => {
                    const conf = this.config.find((control) => control.name === name);
                    this.form.addControl(name, this.createControl(conf));
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
