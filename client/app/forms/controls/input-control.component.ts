import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

@Component({
    selector: 'input-control',
    template: `
        <div [formGroup]="group">
            <md-form-field>
                <input mdInput
                    [type]="spec.subtype"
                    [placeholder]="spec.placeholder"
                    [formControlName]="spec.formControlName"
                    [required]="spec.required">
            </md-form-field>
        </div>
    `
})
export class InputControlComponent extends AbstractFormControl {}
