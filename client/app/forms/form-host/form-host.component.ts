import {
    Component, OnDestroy, OnInit, QueryList,
    ViewChildren
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar, MatSnackBarRef } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';
import * as _ from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject ,  Observable ,  Subscription } from 'rxjs';
import { combineLatest, from, NEVER, of, zip } from 'rxjs';
import {
    catchError,
    filter,
    flatMap,
    map,
    mapTo,
    switchMap,
    switchMapTo
} from 'rxjs/operators';
import {
    MasterTableName, TableHeader, TableMeta
} from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableInsert } from '../../common/table-insert.interface';
import { TableName } from '../../common/table-name.class';
import { unflattenTableNames } from '../../common/util';
import { TableService } from '../../core/table/table.service';
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
    public metaInUse: TableMeta[] = [];
    private mainName: MasterTableName;
    private completedForm$ = new BehaviorSubject<object | null>(null);

    private sub: Subscription;
    private submitSub: Subscription;

    /**
     * Any data requested to have been prefilled when the user presses the
     * "insert like" button in the datatable. If there is no data available,
     * this object will have no keys.
     */
    private prefilled: TableInsert = {};

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

        const pluckedRowJson$ = this.route.queryParams
            .pipe(map((p) => p.row ? JSON.parse(p.row) : null));

        const pluckedRow$: Observable<TableInsert> = combineLatest(
            this.route.params,
            pluckedRowJson$
        )
            .pipe(flatMap((data: [Params, { [key: string]: string } | null]) => {
                const { schema, table } = data[0];
                const pluckSelectors = data[1];
                if (pluckSelectors == null) {
                    return of({});
                } else {
                    return this.backend.pluck(schema, table, pluckSelectors);
                }
            }));

        this.sub = combineLatest(
            this.route.params.pipe(switchMap((params) => this.backend.tables(params.schema))),
            this.route.params,
            pluckedRow$
        )
            .pipe(switchMap((data: [TableName[], Params, TableInsert]) => {
                // Try to identify a MasterTableName for the given raw SQL name
                const [availableTables, {schema, table}, insertLikeRow] = data;
                this.prefilled = insertLikeRow;

                const currentName = availableTables.find((n) => n.schema === schema && n.name.raw === table);
                if (currentName === undefined || currentName.masterName !== null) {
                    // The user has navigated to a table that doesn't exist or a
                    // part table
                    let newPath: string[];

                    if (currentName === undefined)
                        newPath = ['/tables'];
                    else
                        newPath = ['/forms', currentName.masterName!!.raw];

                    return from(this.router.navigate(newPath))
                        .pipe(switchMapTo(NEVER));
                }

                const masterTableNames = unflattenTableNames(availableTables);
                const currentMaster =
                    masterTableNames.find((n) => n.schema === schema && n.name.raw === table);

                if (currentMaster === undefined)
                    throw new Error(`Could not find master table with raw name '${table}'`);

                // The TableName array we use to create PartialFormComponents
                // is comprised of the mainName (as a TableName instead of a
                // MasterTableName) and its parts.
                const tablesInUse = [
                    new TableName(currentMaster.schema, currentMaster.name.raw),
                    ...currentMaster.parts
                ];

                return zip(
                    of(currentMaster),
                    zip(...tablesInUse.map((t) => this.backend.meta(t.schema, t.name.raw)))
                );
            })).subscribe((data: [MasterTableName, TableMeta[]]) => {
                const [currentMaster, allMeta] = data;

                // Reinitialize the FormGroup so that we don't keep data from
                // previously created forms
                if (Object.keys(this.formGroup.controls).length > 0)
                    this.formGroup = this.fb.group({});

                // Pass this data on to the form
                this.mainName = currentMaster;
                this.metaInUse = allMeta;
            });

        this.submitSub = this.completedForm$.pipe(
            // Only allow non-null and non-undefined values
            filter((form) => form !== undefined && form !== null),
            switchMap((form: any) => {
                return this.backend.submitRow(this.mainName.schema, this.mainName.name.raw, form).pipe(
                    // Assume no error
                    mapTo(null),
                    // Handle any errors
                    catchError((err) => {
                        // If the error is an HttpResponse (@angular/common/http),
                        // send its JSON value as an error
                        return of(err);
                    }));
            }),
            flatMap((err: any | null) => {
                let snackbarRef: MatSnackBarRef<any>;

                if (err) {
                    let message = 'Unable add row';

                    if (err.message)
                        message += ` (${err.message})`;

                    snackbarRef = this.snackBar.open(message, 'OK', { duration: 20000 });
                    // Make sure we end up mapping back to the snackbar ref so
                    // we can dismiss it later
                    return snackbarRef.onAction().pipe(mapTo(snackbarRef));
                } else {
                    this.formGroup.reset();
                    snackbarRef = this.snackBar.open('Created new row', 'VIEW', { duration: 3000 });
                    return snackbarRef.onAction().pipe(
                        // Navigate to /tables/:name when 'VIEW' is clicked
                        flatMap(() => from(
                            this.router.navigate(['/tables', this.mainName.schema, this.mainName.name.raw]))),
                        mapTo(snackbarRef));
                }
            }))
            // When we finally reach the end, dismiss the snackbar
            .subscribe((ref: MatSnackBarRef<any>) => ref.dismiss());
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public onSubmit(event: Event) {
        event.preventDefault();
        event.stopPropagation();
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

    public getRole(meta: TableMeta): 'master' | 'part' {
        return new TableName('(unused)', meta.name).isPartTable() ? 'part' : 'master';
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
