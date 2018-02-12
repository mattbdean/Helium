import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control';

@Component({
    selector: 'input-control',
    template: `
        <div [formGroup]="group">
            <mat-form-field>
                <input matInput
                    [type]="spec.subtype"
                    [placeholder]="spec.placeholder"
                    [formControlName]="spec.formControlName"
                    [required]="spec.required">
            </mat-form-field>
        </div>
    `
})
export class InputControlComponent extends AbstractFormControl {}
