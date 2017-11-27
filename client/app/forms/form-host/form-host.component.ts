import { HttpErrorResponse } from '@angular/common/http';
import {
    Component, OnDestroy, OnInit, QueryList,
    ViewChildren
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar, MatSnackBarRef } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import * as _ from 'lodash';
import * as moment from 'moment';

import {
    MasterTableName, TableHeader, TableMeta
} from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name.class';
import { unflattenTableNames } from '../../common/util';
import { TableService } from '../../core/table.service';
import { SCHEMA } from '../../to-be-removed';
import { PartialFormComponent } from '../partial-form/partial-form.component';

/**
 * This component creates a dynamically generated form based on the 'name'
 * parameter of the current route.
 */
@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnDestroy, OnInit {
    public formGroup: FormGroup;
    public names: TableName[] = [];
    private mainName: MasterTableName = null;
    private completedForm$ = new BehaviorSubject<object>(null);

    private sub: Subscription;
    private submitSub: Subscription;

    @ViewChildren('partialForms')
    private partialForms: QueryList<PartialFormComponent>;

    public constructor(
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        private fb: FormBuilder,
        private backend: TableService
    ) {}

    public ngOnInit() {
        // Empty group to start off with
        this.formGroup = this.fb.group({});

        this.sub = Observable.combineLatest(
            this.backend.tables(SCHEMA),
            this.route.params.map((p: Params) => p.name)
        )
            .switchMap((data: [TableName[], string, string]): Observable<MasterTableName> => {
                // Try to identify a MasterTableName for the given raw SQL name
                const allNames = data[0];
                const currentRawName = data[1];

                const currentName = allNames.find((n) => n.rawName === currentRawName);
                if (currentName === undefined || currentName.masterRawName !== null) {
                    // The user has navigated to a table that doesn't exist or a
                    // part table
                    let newPath: string[];

                    if (currentName === undefined)
                        newPath = ['/tables'];
                    else
                        newPath = ['/forms', currentName.masterRawName];

                    return Observable.fromPromise(this.router.navigate(newPath))
                        .switchMapTo(Observable.never());
                }

                const masterTableNames = unflattenTableNames(allNames);
                const currentMaster =
                    masterTableNames.find((n) => n.rawName === currentRawName);
                return Observable.of(currentMaster);
            })
            .subscribe((mainName: MasterTableName) => {
                // Reinitialize the FormGroup so that we don't keep data from
                // previously created forms
                this.formGroup = this.fb.group({});

                this.mainName = mainName;
                // The TableName array we use to create PartialFormComponents
                // is comprised of the mainName (as a TableName instead of a
                // MasterTableName) and its parts.
                this.names = [new TableName(mainName.rawName), ...this.mainName.parts];
            });

        this.submitSub = this.completedForm$
            // Only allow non-null and non-undefined values
            .filter((form) => form !== undefined && form !== null)
            .switchMap((form: any) => {
                return this.backend.submitRow(SCHEMA, this.mainName.rawName, form)
                    // Assume no error
                    .mapTo(null)
                    // Handle any errors
                    .catch((err) => {
                        // If the error is an HttpResponse (@angular/common/http),
                        // send its JSON value as an error
                        let returnedError = err;
                        if (err instanceof HttpErrorResponse) {
                            returnedError = typeof err.error === 'string' ?
                                JSON.parse(err.error) : err.error;
                        }
                        return Observable.of(returnedError);
                    });
            })
            .flatMap((err: any | null) => {
                let snackbarRef: MatSnackBarRef<any>;

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
                    this.formGroup.reset();
                    snackbarRef = this.snackBar.open('Created new row', 'VIEW', { duration: 3000 });
                    return snackbarRef.onAction()
                        // Navigate to /tables/:name when 'VIEW' is clicked
                        .flatMap(() => Observable.fromPromise(
                            this.router.navigate(['/tables', this.mainName.rawName])))
                        .mapTo(snackbarRef);
                }
            })
            // When we finally reach the end, dismiss the snackbar
            .subscribe((ref: MatSnackBarRef<any>) => ref.dismiss());
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public onSubmit(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        // TODO do something with the submitted form
        // formGroup.value does not contain disabled form controls (necessary
        // for blobs and bound part table foreign keys), use
        // formGroup.getRawValue() instead
        const raw = this.formGroup.getRawValue();

        // Find all TableMeta objects pulled from the API by each PartialFormComp.
        const metadata = this.partialForms.toArray().map((f) => f.meta);

        // Transform dates/datetimes into their appropriate formats
        const preformatted = FormHostComponent.preformatAll(raw, metadata);

        // Send the submitted form up into the pipeline
        this.completedForm$.next(preformatted);
    }

    /**
     * This function preformats every entry for every table in a form object
     * (see {@link preformat}).
     */
    private static preformatAll(raw: { [tableName: string]: object[] }, metadata: TableMeta[]) {
        const preformatted: { [tableName: string]: object[] } = {};

        for (const tableName of Object.keys(raw)) {
            const meta = metadata.find((m) => m.name === tableName);
            if (meta === undefined)
                throw new Error(`Could not find metadata for table ${tableName}`);
            preformatted[tableName] = [];

            for (let i = 0; i < raw[tableName].length; i++) {
                preformatted[tableName][i] =
                    FormHostComponent.preformat(raw[tableName][i], meta.headers);
            }
        }

        return preformatted;
    }

    /**
     * Takes care of any date/datetime formatting, if necessary. Returns a copy
     * of the original form with dates and datetimes formatted in the way that
     * the API expects.
     */
    private static preformat(form: any, headers: TableHeader[]): any {
        return _.mapValues(form, (value, controlName) => {
            const header = _.find(headers, (h) => h.name === controlName);
            if (header === undefined)
                throw new Error(`Could not find header for control '${controlName}'`);
            if (header.type === 'date')
                return moment(value).format(DATE_FORMAT);
            else if (header.type === 'datetime')
                return moment(value).format(DATETIME_FORMAT);

            return value;
        });
    }
}
