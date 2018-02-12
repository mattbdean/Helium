import { Component, ViewChild } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control';
import { DatetimeInputComponent } from '../../core/datetime-input/datetime-input.component';

/**
 * As its name suggests, this component wraps the DatetimeInputControl from the
 * core module for use with dynamic forms.
 */
@Component({
    selector: 'datetime-control',
    template: `
        <div [formGroup]="group">
            <datetime-input
                [formControlName]="spec.formControlName"
                [placeholder]="spec.placeholder"
                [required]="spec.required"></datetime-input>
        </div>
    `
})
export class DatetimeControlWrapperComponent extends AbstractFormControl {
}
