
import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

/**
 * Handles dates both with and without times.
 */
@Component({
    selector: 'date-time-control',
    template: `
        <div [formGroup]="group">
            <md-form-field>
                <input mdInput
                       [mdDatepicker]="picker"
                       [type]="spec.subtype"
                       [placeholder]="spec.placeholder"
                       [formControlName]="spec.formControlName"
                       [required]="spec.required">
                <md-datepicker-toggle mdSuffix [for]="picker"></md-datepicker-toggle>
                <md-datepicker #picker></md-datepicker>
            </md-form-field>
        </div>
    `
})
export class DateTimeControlComponent extends AbstractFormControl {}
