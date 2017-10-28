import { Component } from '@angular/core';
import { AbstractFormControl } from './abstract-form-control.class';

@Component({
    selector: 'enumerated-control',
    template: `
        <div class="enum-wrapper" [formGroup]="group">
            <mat-select
                [required]="spec.required"
                [placeholder]="spec.placeholder"
                [formControlName]="spec.formControlName">
                <mat-option *ngFor="let option of spec.enumValues" [value]="option">{{ option }}</mat-option>
            </mat-select>
        </div>
    `,
    styles: [`
        .enum-wrapper {
            padding-bottom: 15px;
        }
    `]
})
export class EnumeratedControlComponent extends AbstractFormControl {}
