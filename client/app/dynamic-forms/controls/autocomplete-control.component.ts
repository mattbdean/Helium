import { Component, OnInit } from '@angular/core';
import * as Fuse from 'fuse.js';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { AbstractFormControl } from './abstract-form-control';

interface AutocompleteOption { value: string; }

/**
 * This component provides autocomplete functionality for a dynamic form. The
 * provided FormControlSpec must have a non-undefined `autocompleteValues`.
 */
@Component({
    selector: 'autocomplete-control',
    template: `
        <div [formGroup]="group">
            <mat-form-field>
                <input matInput
                       [type]="spec.subtype"
                       [matAutocomplete]="auto"
                       [placeholder]="spec.placeholder"
                       [formControlName]="spec.formControlName"
                       [required]="spec.required">
                <mat-icon class="row-picker-button"
                    matSuffix
                    *ngIf="spec.onRequestRowPicker"
                    (click)="onRequestRowPicker($event)">search</mat-icon>
            </mat-form-field>
            
            <mat-autocomplete #auto="matAutocomplete">
                <mat-option *ngFor="let option of currentSuggestions | async" [value]="option">
                    {{ option }}
                </mat-option>
            </mat-autocomplete>
        </div>
    `,
    styles: [`
        .row-picker-button {
            cursor: pointer;
        }
    `]
})
export class AutocompleteControlComponent extends AbstractFormControl implements OnInit {
    /** The options passed to the Fuse constructor */
    private static fuseOptions: Fuse.FuseOptions = {
        location: 0,
        keys: ['value']
    };

    public currentSuggestions: Observable<string[]>;

    public ngOnInit(): void {
        const formControl = this.group.get(this.spec.formControlName);

        if (formControl === null)
            throw new Error(`Form control with name ${this.spec.formControlName} does not exist`);

        // Start with an empty string so suggestions pop up before the user has
        // to type anything
        const userInput$ = formControl.valueChanges
            .pipe(startWith(''));

        // Listen to changes in the autocomplete values and construct Fuse
        // objects for that data when it changes
        const fuse$ = this.spec.autocompleteValues!!.pipe(
            map((values: string[]): AutocompleteOption[] =>
                // Wrap each value in an AutocompleteOption so Fuse can work
                // with it
                values.map((it) => ({ value: String(it) }))),
            map((options: AutocompleteOption[]) =>
                new Fuse(options, AutocompleteControlComponent.fuseOptions))
        );
        
        this.currentSuggestions = combineLatest(userInput$, fuse$).pipe(
            map((params: [string, Fuse]) => {
                const [input, fuse] = params;

                // Everything is applicable for no input. Otherwise use fuse to
                // search
                const results: AutocompleteOption[] = input.length === 0 ?
                    (fuse as any).list : fuse.search(input);

                // Unwrap the AutocompleteOption to its string value
                return results.map((r: AutocompleteOption) => r.value);
            })
        );
    }

    public onRequestRowPicker(event: Event) {
        // Stop the mat-input from also receiving the event and highlighting
        // the control
        event.preventDefault();
        event.stopPropagation();
        this.spec.onRequestRowPicker!!(this.spec.formControlName);
    }
}
