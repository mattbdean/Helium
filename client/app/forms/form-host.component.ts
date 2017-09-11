import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MdSnackBar, MdSnackBarRef } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import * as _ from 'lodash';
import * as moment from 'moment';

import { TableService } from '../core/table.service';

import { TableHeader } from '../../../common/api';
import { TableMeta, TableName } from '../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../common/constants';
import { createTableName } from '../common/util';
import { FormContainerComponent } from './form-container.component';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnDestroy, OnInit {
    private metaSub: Subscription;
    private formSubmitSub: Subscription;

    private completedForm$ = new BehaviorSubject<object>(null);

    public exists: boolean = false;
    public masterMeta: TableMeta;
    public name: TableName;

    @ViewChild(FormContainerComponent)
    private masterForm: FormContainerComponent;

    public constructor(
        private backend: TableService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MdSnackBar
    ) { }

    public ngOnInit() {
        this.metaSub = Observable.combineLatest(
            this.route.params.map((params: Params) => params.name),
            this.backend.list()
        )
            .flatMap((data: [string, TableName[]]) => {
                const requestedRawName = data[0];
                const actualNames = data[1];

                const foundName: TableName | undefined =
                    _.find(actualNames, (n) => n.rawName === requestedRawName);

                // We don't know anything about this specific name
                if (foundName === undefined)
                    return Observable.of(null);

                // Automatically redirect the user to the master form if they
                // try to navigate to a part table
                if (foundName.masterRawName !== null) {
                    const routeProm = this.router.navigate(['/forms', this.name.masterRawName]);
                    return Observable.fromPromise(routeProm)
                        .flatMapTo(Observable.never());
                }

                const rawNames = [foundName.rawName];
                const parts = _.filter(actualNames, (n) => n.masterRawName === foundName.rawName);
                rawNames.push(..._.map(parts, (p) => p.rawName));
                const observables = _.map(rawNames, (n) => this.backend.meta(n));

                return Observable.combineLatest(...observables);
            })
            .subscribe((data: TableMeta[] | null) => {
                this.exists = data !== null;
                if (this.exists) {
                    const sorted = _.sortBy(data, (m) => m.name);
                    this.masterMeta = sorted[0];
                    // TODO
                    // const parts = sorted.slice(1);

                    this.name = createTableName(this.masterMeta.name);
                }
            });

        this.formSubmitSub = this.completedForm$
            // Prevent any null or undefined values from being submitted
            .filter((form: any) => form !== null && form !== undefined)
            // Try to submit the row. switchMap to any error that occurred
            // during the process
            .map((form: any) => FormHostComponent.preformat(form, this.masterMeta.headers))
            .switchMap((form: any) => {
                return this.backend.submitRow(this.name.rawName, form)
                    // Assume no error
                    .mapTo(null)
                    // Handle any errors
                    .catch((err) => {
                        // If the error is an HttpResponse (@angular/common/http),
                        // send its JSON value as an error
                        return Observable.of(err instanceof HttpErrorResponse ? err.error : err);
                    });
            })
            // Handle success/error
            .flatMap((err: any | null) => {
                let snackbarRef: MdSnackBarRef<any>;

                if (err) {
                    let message = 'Unable add row';

                    if (err.message)
                        message += ` (${err.message})`;

                    snackbarRef = this.snackBar.open(message, 'OK', { duration: 20000 });
                    // Make sure we end up mapping back to the snackbar ref so
                    // we can dismiss it later
                    return snackbarRef.onAction()
                        .mapTo(snackbarRef);
                } else {
                    this.masterForm.reset();
                    snackbarRef = this.snackBar.open('Created new row', 'VIEW', { duration: 3000 });
                    return snackbarRef.onAction()
                        // Navigate to /tables/:name when 'VIEW' is clicked
                        .flatMap(() => Observable.fromPromise(this.router.navigate(['/tables', this.name.rawName])))
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

    /**
     * Takes care of any date/datetime formatting, if necessary. Returns a copy
     * of the original form with dates and datetimes formatted in the way that
     * the API expects.
     */
    private static preformat(form: any, headers: TableHeader[]): any {
        return _.mapValues(form, (value, controlName) => {
            const header = _.find(headers, (h) => h.name === controlName);
            if (header.type === 'date')
                return moment(value).format(DATE_FORMAT);
            else if (header.type === 'datetime')
                return moment(value).format(DATETIME_FORMAT);

            return value;
        });
    }
}
