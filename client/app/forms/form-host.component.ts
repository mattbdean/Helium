import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';
import { MdSnackBar, MdSnackBarRef } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { Observable } from "rxjs/Observable";
import { Subscription } from "rxjs/Subscription";

import * as _ from 'lodash';

import { BOOLEAN_TYPE } from '../core/constants';
import { TableService } from '../core/table.service';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FieldConfig } from '../dynamic-form/field-config.interface';

import { Response } from "@angular/http";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import { TableHeader, TableMeta } from '../common/responses';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnDestroy, OnInit {
    @ViewChild(DynamicFormComponent)
    private form: DynamicFormComponent;

    private metaSub: Subscription;
    private formSubmitSub: Subscription;

    private completedForm$ = new BehaviorSubject<any>(null);

    public config: FieldConfig[] = [];
    public name: string;

    public constructor(
        private backend: TableService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MdSnackBar
    ) { }

    public ngOnInit() {
        this.metaSub = this.route.params.switchMap((params: Params) => {
            this.name = params.name;

            return this.backend.meta(this.name)
                .catch(() => {
                    return Observable.of(null);
                });
        }).subscribe((meta: TableMeta | null) => {
            this.config = meta === null ? null : this.createConfigFor(meta);
        });

        this.formSubmitSub = this.completedForm$
            // Prevent any null or undefined values from being submitted
            .filter((form: any) => form !== null && form !== undefined)
            // Try to submit the row. switchMap to any error that occurred
            // during the process
            .switchMap((form: any) => {
                return this.backend.submitRow(this.name, form)
                    // Assume no error
                    .mapTo(null)
                    // Handle any errors
                    .catch((err) => {
                        // If the error is a Response (@angular/http), send its
                        // JSON value as an error
                        return Observable.of(err instanceof Response ? err.json() : err);
                    });
            })
            // Handle success/error
            .flatMap((err: any | null) => {
                let snackbarRef: MdSnackBarRef<any>;

                if (err) {
                    let message = 'Unable add row';

                    if (err.message)
                        message += ` (${err.message})`;

                    snackbarRef = this.snackBar.open(message, "OK", { duration: 20000 });
                    // Make sure we end up mapping back to the snackbar ref so
                    // we can dismiss it later
                    return snackbarRef.onAction()
                        .mapTo(snackbarRef);
                } else {
                    this.form.form.reset();
                    snackbarRef = this.snackBar.open('Created new row', 'VIEW', { duration: 3000 });
                    return snackbarRef.onAction()
                        // Navigate to /tables/:name when 'VIEW' is clicked
                        .flatMap(() => Observable.fromPromise(this.router.navigate(['/tables', this.name])))
                        .mapTo(snackbarRef);
               }
            })
            // When we finally reach the end, dismiss the snackbar
            .subscribe((ref: MdSnackBarRef<any>) => ref.dismiss());
    }

    public ngOnDestroy(): void {
        this.metaSub.unsubscribe();
        this.formSubmitSub.unsubscribe();
    }

    public onFormSubmitted(form) {
        this.completedForm$.next(form);
    }

    private createConfigFor(meta: TableMeta): FieldConfig[] {
        const config = meta.headers.map((h: TableHeader): FieldConfig => {
            const type = h.enumValues !== null ? 'select' : 'input';

            let initialValue: undefined | any;

            // Default to string input
            let subtype = 'text';

            if (h.rawType === BOOLEAN_TYPE) {
                subtype = 'checkbox';
                // For checkboxes we MUST specify an initial value. If we don't,
                // submitting the form without touching the control will result
                // in an undefined value, instead of false, like the user likely
                // assumes it will be.
                initialValue = false;
            } else if (h.isNumber) {
                // Numerical
                subtype = 'number';
            } else if (h.type === 'date') {
                // Dates and timestamp
                subtype = 'date';
            } else if (h.type === 'timestamp') {
                subtype = 'datetime-local';
            }

            const validation: ValidatorFn[] = [];
            if (!h.nullable) validation.push(Validators.required);

            let fetchAutocompleteValues: () => Promise<any[]>;

            const constraint = _.find(meta.constraints, (c) => c.localColumn === h.name);
            if (constraint && constraint.type === 'foreign') {
                fetchAutocompleteValues = () =>
                    this.backend.columnValues(constraint.foreignTable, constraint.foreignColumn).toPromise();
            }

            return {
                name: h.name,
                label: h.name,
                type,
                subtype,
                options: h.enumValues,
                validation,
                // hint: h.comment
                fetchAutocompleteValues,
                required: !h.nullable,
                value: initialValue
            };
        });
        // Add the submit button
        config.push({
            type: 'submit',
            label: 'SUBMIT',
            name: 'submit',
            // Set initially disabled, will become enabled again once the
            // form is valid
            disabled: true
        });

        return config;
    }
}
