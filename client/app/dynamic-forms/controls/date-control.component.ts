
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
                       [title]="spec.hoverHint"
                       [required]="spec.required">
                <mat-error *ngIf="currentError() !== null">{{ currentError() }}</mat-error>
            </mat-form-field>
        </div>
    `
})
export class DateControlComponent extends AbstractFormControl {}
