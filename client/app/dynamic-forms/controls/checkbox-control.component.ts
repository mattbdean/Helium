import { Component } from '@angular/core';

import { AbstractFormControl } from './abstract-form-control';

@Component({
    selector: 'checkbox-control',
    template: `
        <div [formGroup]="group">
            <mat-checkbox [formControlName]="spec.formControlName" color="primary">{{ spec.placeholder }}</mat-checkbox>
        </div>
    `,
    styles: [`
        ::ng-deep .mat-checkbox-layout { padding-bottom: 10px; }
    `]
})
export class CheckboxControlComponent extends AbstractFormControl {}
