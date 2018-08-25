import { Component } from '@angular/core';
import * as moment from 'moment';
import { AbstractFormControl } from './abstract-form-control';

/**
 * Gathers a year, month, and date from the user.
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
                <span matSuffix>
                    <mat-icon class="insert-now-button"
                        matSuffix
                        title="Set to current date"
                        (click)="handleInsertNow()">home</mat-icon>
                </span>
                <mat-error *ngIf="currentError() !== null">{{ currentError() }}</mat-error>
            </mat-form-field>
        </div>
    `,
    styles: [`
        .insert-now-button {
            cursor: pointer;
        }
    `]
})
export class DateControlComponent extends AbstractFormControl {
    public handleInsertNow() {
        this.group.get(this.spec.formControlName)!.setValue(moment().format('YYYY-MM-DD'));
    }
}
