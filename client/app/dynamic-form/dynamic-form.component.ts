import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
    selector: 'dynamic-form',
    template: `
    <form class="dynamic-form" [formGroup]="form" (ngSubmit)="submitted.emit(form.value)">
        <ng-container *ngFor="let field of config" dynamicField [config]="field" [group]="form"></ng-container>
    </form>
    `
})

export class DynamicFormComponent implements OnInit {
    @Input()
    public config: any[] = [];

    @Output()
    public submitted: EventEmitter<any> = new EventEmitter<any>();

    private form: FormGroup;

    public constructor(private fb: FormBuilder) {}

    public ngOnInit() {
        this.form = this.createGroup();
    }

    private createGroup(): FormGroup {
        const group = this.fb.group({});
        this.config.forEach((control) => group.addControl(control.name, this.fb.control(undefined)));
        return group;
    }
}
