import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

@Component({
    selector: 'input-control',
    template: `
        <div [formGroup]="group">
            <md-form-field>
                <input type="text" mdInput [placeholder]="spec.placeholder" [formControlName]="spec.formControlName">
            </md-form-field>
        </div>
    `
})
export class InputControlComponent extends AbstractFormControl {
}
