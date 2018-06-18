import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control';

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
                [title]="spec.hoverHint"
                [required]="spec.required"></datetime-input>
        </div>
    `
})
export class DatetimeControlWrapperComponent extends AbstractFormControl {
}
