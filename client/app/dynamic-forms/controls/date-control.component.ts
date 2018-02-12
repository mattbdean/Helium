
import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control';

/**
 * Handles dates both with and without times.
 */
@Component({
    selector: 'date-control',
    template: `
        <div [formGroup]="group">
            <mat-form-field>
                <input matInput
                       type="date"
                       [placeholder]="spec.placeholder"
                       [formControlName]="spec.formControlName"
                       [required]="spec.required">
            </mat-form-field>
        </div>
    `
})
export class DateControlComponent extends AbstractFormControl {}
