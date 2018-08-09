import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, Input, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarRef } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { isEqual, pickBy, zipObject } from 'lodash';
import { BehaviorSubject, combineLatest, from, merge, Observable, of, Subscription, zip } from 'rxjs';
import {
    catchError,
    delay,
    distinctUntilChanged,
    map,
    mapTo,
    shareReplay,
    skip,
    startWith,
    switchMap,
    tap
} from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ErrorResponse, SqlRow, TableInsert, TableMeta } from '../../common/api';
import { flattenCompoundConstraints } from '../../common/util';
import { ApiService } from '../../core/api/api.service';
import { PartialFormComponent } from '../partial-form/partial-form.component';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnInit, AfterViewInit, OnDestroy {
    /** If true, bound controls will be hidden from the user.  */
    @Input()
    public disableBoundControls = true;

    /** True if running in preview mode */
    public get preview() { return environment.preview; }

    /**
     * Gets the current value of the form. If the form is valid, this object be
     * sent directly to the API.
     */
    public get value(): TableInsert {
        const result = zipObject(
            this.partialForms.map((p) => p.meta.name),
            this.partialForms.map((p) => p.value)
        );

        // Only care about partial forms with data in them
        return pickBy(result, (val) => {
            return val.length > 0;
        }) as TableInsert;
    }

    public get masterTable(): TableMeta {
        const partialForm = this.partialForms.find((p) => p.role === 'master');
        if (partialForm === undefined) {
            throw new Error('No master table');
        }

        return partialForm.meta;
    }

    /**
     * Emits true when the form becomes valid and false when the form becomes
     * invalid
     */
    public validityChange: Observable<boolean>;

    /**
     * Data used to create partial forms. Bundled into one Observable so that
     * table metadata and prefilled data are never mismatched.
     */
    public data$: Observable<PartialFormData[]>;

    /**
     * Emits a boolean indicating whether a form can be submitted, regardless of
     * value. This only ever emits false when there is a non-null blob column
     * present in the table in question or in one of its part tables since the
     * API will refuse to take input for blobs.
     */
    public submittable$: Observable<boolean>;

    @ViewChildren(PartialFormComponent)
    private partialForms: QueryList<PartialFormComponent>;

    private completedForm$ = new BehaviorSubject<TableInsert>({});

    private pluckSelectorsUsed = false;

    private bindingSub: Subscription;

    public constructor(
        private api: ApiService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar
    ) {}

    public ngOnInit() {
        const pluckedRows$ = combineLatest(
            this.route.params,
            this.route.queryParams
        ).pipe(
            switchMap((data: [Params, { [key: string]: string } | null]) => {
                const { schema, table } = data[0];
                const pluckSelectors = data[1];

                let result: Observable<TableInsert>;
                if (this.pluckSelectorsUsed || pluckSelectors == null || Object.keys(pluckSelectors).length === 0) {
                    result = of({});
                } else {
                    result = this.api.pluck(schema, table, pluckSelectors);
                }

                this.pluckSelectorsUsed = true;

                return result;
            }),
            distinctUntilChanged(isEqual)
        );

        const tables$ = this.route.params.pipe(
            switchMap((params: { schema: string, table: string }) =>
                // Fetch the table in question
                this.api.meta(params.schema, params.table)),
            switchMap((masterMeta: TableMeta): Observable<TableMeta[]> => {
                // Fetch all part tables
                const parts = masterMeta.parts.map((n) => this.api.meta(n.schema, n.name.raw));
                return zip(of(masterMeta), ...parts);
            }),
            shareReplay(1)
        );

        this.submittable$ = tables$.pipe(
            map((tables) => {
                for (const table of tables) {
                    for (const header of table.headers) {
                        if (header.type === 'blob' && !header.nullable)
                            // Non-null blob, unsubmittable
                            return false;
                    }
                }

                return true;
            }),
            // Assume the form is submittable
            startWith(true)
        );

        this.data$ = combineLatest(pluckedRows$, tables$).pipe(
            map(([pluckedRows, tables]: [TableInsert, TableMeta[]]): PartialFormData[] => {
                return tables.map((meta): PartialFormData => ({
                    meta,
                    initialForm: pluckedRows[meta.name] ? pluckedRows[meta.name] : []
                }));
            })
        );

        this.completedForm$.pipe(
            // First emission is a placeholder
            skip(1),
            switchMap((form: TableInsert) => {
                return this.api.submitRow(this.masterTable.schema, form).pipe(
                    catchError((err: any) => {
                        if (err.name === 'HttpErrorResponse') {
                            // err.error is the JSON returned by the API
                            return of(err.error as ErrorResponse);
                        }
                        return of(err);
                    }),
                    tap((err) => {
                        if (!err) this.reset();
                    }),
                    switchMap((err: ErrorResponse | any | null) => {
                        const message = err ? (err.message ? err.message : 'Unable to add row') :
                            'Created new row';
                        const action = err ? 'OK' : 'VIEW';
                        const duration = err ? undefined : 3000;

                        const snackBarRef = this.snackBar.open(message, action, { duration });

                        let action$: Observable<any> = snackBarRef.onAction();

                        if (!err) {
                            action$ = action$.pipe(
                                switchMap(() => from(this.router.navigate([
                                    '/tables',
                                    this.masterTable.schema,
                                    this.masterTable.name
                                ])))
                            );
                        }

                        return action$.pipe(mapTo(snackBarRef));
                    })
                );
            })
        ).subscribe((ref: MatSnackBarRef<any>) => {
            ref.dismiss();
        });
    }

    public ngAfterViewInit() {
        this.validityChange = this.partialForms.changes.pipe(
            switchMap((ql: QueryList<PartialFormComponent>) => {
                return combineLatest(...ql.toArray().map((partial) => partial.validityChange));
            }),
            map((validities: boolean[]) => {
                return validities.find((v) => v === false) === undefined;
            }),
            // Wait until next tick for change detection purposes
            delay(1)
        );

        this.bindingSub = this.partialForms.changes.pipe(
            switchMap((ql: QueryList<PartialFormComponent>) => {
                const partialForms = ql.toArray();
                // There has to be exactly 1 master table for this to work
                const masterFormIndex = partialForms.findIndex((p) => p.role === 'master');
                if (masterFormIndex < 0)
                    throw new Error('No master table form');
                
                // Keep track of the master/part tables
                const masterForm = partialForms.splice(masterFormIndex, 1)[0];
                const masterTable = masterForm.meta;
                const partTablePartials = partialForms;

                const bindings: Array<Observable<FormBinding>> = [];

                for (const partTable of partTablePartials) {
                    // Identify constraints in part tables that reference the
                    // master table
                    const bindingConstraints = flattenCompoundConstraints(partTable.meta.constraints)
                        .filter((c) => c.type === 'foreign' &&
                            c.ref!.schema === masterTable.schema &&
                            c.ref!.table === masterTable.name);
                    
                    for (const bindingConstraint of bindingConstraints) {
                        // Keep track of the source FormControl in the master
                        // table and all FormControls in each partial form
                        const obs: Observable<FormBinding> = combineLatest(
                            masterForm.get(bindingConstraint.ref!.column, 0),
                            partTable.getAll(bindingConstraint.localColumn)
                        ).pipe(
                            // Pretty the output up a bit
                            map(([source, dest]: [FormControl, FormControl[]]) => {
                                return { source, dest };
                            })
                        );
                        bindings.push(obs);
                    }
                }

                return combineLatest(...bindings);
            }),
            switchMap((bindings: FormBinding[]) => {
                const observables = bindings.map((b) => {
                    // Watch for value changes in the source (master) control
                    return b.source.valueChanges.pipe(
                        // Make sure new entries get this value as well
                        startWith(b.source.value),
                        map((newValue: any): BoundFormUpdate => {
                            return {
                                value: newValue,
                                dest: b.dest
                            };
                        })
                    );
                });

                return merge(...observables);
            })
        ).subscribe((update: BoundFormUpdate) => {
            // Update the bound controls
            for (const boundControl of update.dest) {
                boundControl.setValue(update.value);

                if (this.disableBoundControls)
                    // Do this on next event loop cycle for change detection
                    // purposes
                    setTimeout(() => boundControl.disable(), 0);
            }
        });
    }

    public ngOnDestroy() {
        if (this.bindingSub)
            this.bindingSub.unsubscribe();
    }

    public handleSubmit() {
        this.completedForm$.next(this.value);
    }

    private reset() {
        for (const form of this.partialForms.toArray()) {
            form.reset();
        }
    }
}

interface PartialFormData {
    initialForm: SqlRow[];
    meta: TableMeta;
}

interface FormBinding {
    source: FormControl;
    dest: FormControl[];
}

interface BoundFormUpdate {
    value: any;
    dest: FormControl[];
}
