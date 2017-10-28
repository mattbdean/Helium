
import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

/**
 * Handles dates both with and without times.
 */
@Component({
    selector: 'date-time-control',
    template: `
        <div [formGroup]="group">
            <mat-form-field>
                <input matInput
                       [matDatepicker]="picker"
                       [type]="spec.subtype"
                       [placeholder]="spec.placeholder"
                       [formControlName]="spec.formControlName"
                       [required]="spec.required">
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
        </div>
    `
})
export class DateTimeControlComponent extends AbstractFormControl {}
