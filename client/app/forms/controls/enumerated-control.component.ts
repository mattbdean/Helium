import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

@Component({
    selector: 'enumerated-control',
    template: `
        <div class="enum-wrapper" [formGroup]="group">
            <md-select [placeholder]="spec.placeholder" [formControlName]="spec.formControlName">
                <md-option *ngFor="let option of spec.enumValues" [value]="option">{{ option }}</md-option>
            </md-select>
        </div>
    `,
    styles: [`
        .enum-wrapper {
            padding-bottom: 15px;
        }
    `]
})
export class EnumeratedControlComponent extends AbstractFormControl {}
