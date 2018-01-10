import { Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material';
import { BehaviorSubject, Observable, Subscription } from 'rxjs/Rx';

import * as _ from 'lodash';
import * as moment from 'moment';

import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs/Subject';
import {
    Constraint, Filter, SqlRow, TableHeader, TableMeta
} from '../../common/api';
import { TableService } from '../../core/table.service';

import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name.class';

interface ConstraintGrouping {
    [headerName: string]: Constraint[];
}

/**
 * Short version of @swimlane/ngx-datatable's DataTableColumnDirective:
 * https://github.com/swimlane/ngx-datatable/blob/master/src/components/columns/column.directive.ts
 */
interface DataTableHeader {
    name: string;
    prop: string;
}

@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements OnInit, OnDestroy {

    @Input()
    public set name(value: TableName) { this._name$.next(value); }
    public get name(): TableName { return this._name$.getValue()!!; }

    public set pageNumber(value) { this._pageNumber$.next(value); }
    public get pageNumber() { return this._pageNumber$.getValue(); }

    private set sort(value) { this._sort$.next(value); }

    public set meta(value) { this._meta$.next(value); }
    public get meta() { return this._meta$.getValue()!!; }

    private _name$ = new BehaviorSubject<TableName | null>(null);
    private _pageNumber$ = new BehaviorSubject(1);
    private _sort$ = new BehaviorSubject(null);
    private _meta$ = new BehaviorSubject<TableMeta | null>(null);
    private _filters$ = new BehaviorSubject<Filter[]>([]);

    private nameSub: Subscription;
    private pageInfoSub: Subscription;

    private constraints: ConstraintGrouping = {};
    public tableHeaders: DataTableHeader[];

    @ViewChild('headerTemplate') private headerTemplate: TemplateRef<any>;
    @ViewChild('headerTemplateInsertLike') private headerTemplateInsertLike: TemplateRef<any>;
    @ViewChild('cellTemplate') private cellTemplate: TemplateRef<any>;
    @ViewChild('cellTemplateBlob') private cellTemplateBlob: TemplateRef<any>;
    @ViewChild('cellTemplateInsertLike') private cellTemplateInsertLike: TemplateRef<any>;

    /** True if this component has tried to access the table and found data */
    public exists: boolean = true;
    public loading = false;

    /** How many rows to fetch per page */
    public readonly limit: number = 25;

    public data: SqlRow[] = [];

    /**
     * The width in pixels of the very first column that contains a button to
     * insert data similar to the row that its hosted in
     */
    private static readonly INSERT_LIKE_COLUMN_WIDTH = 40;
    private static readonly DISPLAY_FORMAT_DATE = 'l';
    private static readonly DISPLAY_FORMAT_DATETIME = 'LLL';

    constructor(
        private backend: TableService,
        private router: Router,
        private snackBar: MatSnackBar
    ) {}

    public ngOnInit(): void {
        const pageInfo = Observable.combineLatest(
            this._meta$,
            this._name$,
            this._pageNumber$,
            this._sort$,
            this._filters$
                // Don't propagate unless there's new data
                .distinctUntilChanged(_.isEqual)
                // Disable debounce time when all filters are removed to keep
                // UI snappy
                .debounce((filters: Filter[]) =>
                    Observable.timer(filters.length === 0 ? 0 : 300))
        );

        // When pauser emits true, pausable will map to an Observable that never
        // emits any values. When pauser emits false, it will map to pageInfo
        const pauser = new Subject<boolean>();
        const pausable = pauser.switchMap((paused) => paused ? Observable.never() : pageInfo);

        this.nameSub = this._name$
            .distinctUntilChanged()
            // Pause pageInfo
            .do(() => { pauser.next(true); })
            .filter((n) => n !== null)
            .map((m) => m!!)
            .switchMap((name) => {
                return this.backend.meta(name.schema, name.name.raw)
                    .catch((err: HttpErrorResponse) => {
                        this.exists = false;

                        if (err.status !== 404) {
                            // TODO: Unexpected errors could be handled more
                            // gracefully
                            throw err;
                        }

                        return Observable.never();
                    });
            })
            .subscribe((meta: TableMeta) => {
                this.exists = true;
                this.tableHeaders = this.createTableHeaders(meta.headers);
                this.constraints = _.groupBy(meta.constraints, 'localColumn');

                // Reset to defaults
                this.meta = meta;
                this.pageNumber = 1;
                this.sort = null;

                // Unpause pageInfo
                pauser.next(false);
            });

        this.pageInfoSub = pausable.switchMap((params: [TableMeta, TableName, number, string, Filter[]]) => {
            const [meta, tableName, pageNumber, sort, filters] = params;
            return this.backend.content(tableName.schema, tableName.name.raw, pageNumber, this.limit, sort, filters)
                .map((rows) => ({rows: this.formatRows(meta.headers, rows)}))
                .catch((err) => {
                    return Observable.of({err, rows: []});
                });
        }).subscribe((result: { err?: Error, rows: SqlRow[] }) => {
            if (result.err) {
                console.error(result.err);

                let message: string = result.err.message;
                if (result.err instanceof HttpErrorResponse) {
                    message = `Server responded with ${result.err.status} ${result.err.statusText}`;
                }

                this.snackBar.open(message, 'OK', { duration: 5000 } );
            }

            this.data = result.rows;
        });
    }

    public ngOnDestroy(): void {
        // Clean up our subscriptions
        this.nameSub.unsubscribe();
        this.pageInfoSub.unsubscribe();
    }

    public onPaginate(event: any) {
        // page 1 === offset 0, page 2 === offset 1, etc.
        this.pageNumber = event.offset + 1;
    }

    public onSort(event: any) {
        const sortDirPrefix = event.sorts[0].dir === 'desc' ? '-' : '';
        // '-prop' for descending, 'prop' for ascending
        this.sort = sortDirPrefix + event.sorts[0].prop;
    }

    public onInsertLike(row: object) {
        return this.router.navigate(['/forms', this.name.schema, this.name.name.raw], {
            queryParams: this.createQueryParams(row)
        });
    }

    public onFiltersChanged(filters: Filter[]) {
        this._filters$.next(filters);
    }

    private createQueryParams(row: object) {
        const reformatted = _.clone(row);

        // Find all date and datetime headers and transform them from their
        // display format to the API format
        for (const headerName of Object.keys(reformatted)) {
            const header = _.find(this.meta.headers, (h) => h.name === headerName);
            if (header === undefined)
                throw new Error('Can\'t find header with name ' + headerName);

            if (header.type === 'date')
                reformatted[headerName] = moment(reformatted[headerName],
                    DatatableComponent.DISPLAY_FORMAT_DATE).format(DATE_FORMAT);
            if (header.type === 'datetime')
                reformatted[headerName] = moment(reformatted[headerName],
                    DatatableComponent.DISPLAY_FORMAT_DATETIME).format(DATETIME_FORMAT);
        }

        return { prefilled: JSON.stringify(reformatted) };
    }

    private createTableHeaders(headers: TableHeader[]): DataTableHeader[] {
        const regularHeaders: any[] = _(headers)
            .map((h) => ({
                name: h.name,
                prop: h.name,
                cellTemplate: h.type === 'blob' ? this.cellTemplateBlob : this.cellTemplate,
                headerTemplate: this.headerTemplate
            }))
            .sortBy('ordinalPosition')
            .value();

        // Only add the 'insert like' column for master tables
        if (this.name.masterName === null)
            regularHeaders.unshift({
                name: '__insertLike',
                prop: '__insertLike',
                cellTemplate: this.cellTemplateInsertLike,
                headerTemplate: this.headerTemplateInsertLike,
                maxWidth: DatatableComponent.INSERT_LIKE_COLUMN_WIDTH,
                minWidth: DatatableComponent.INSERT_LIKE_COLUMN_WIDTH,
                resizeable: false
            });
        return regularHeaders;
    }

    private formatRows(headers: TableHeader[], rows: SqlRow[]): SqlRow[] {
        const copied = _.clone(rows);

        // Iterate through each row
        for (const row of copied) {
            // Iterate through each cell in that row
            for (const headerName of Object.keys(row)) {
                const header = _.find(headers, (h) => h.name === headerName);
                if (header === undefined)
                    throw new Error('Can\'t find header with name ' + headerName);

                // Use moment to format dates and times in the default format
                if (header.type === 'date')
                    row[headerName] = DatatableComponent.reformat(row[headerName],
                        DATE_FORMAT, DatatableComponent.DISPLAY_FORMAT_DATE);
                if (header.type === 'datetime')
                    row[headerName] = DatatableComponent.reformat(row[headerName],
                        DATETIME_FORMAT, DatatableComponent.DISPLAY_FORMAT_DATETIME);
                if (header.type === 'boolean')
                    // Resolve either the 1 or 0 to its boolean value
                    row[headerName] = !!row[headerName];
            }
        }

        return copied;
    }

    /**
     * Tries to format a given date into the format given. If the source is not
     * a valid date, returns null.
     * 
     * @param source A string parsable by Moment
     * @param input Input moment format
     * @param output Output moment format
     */
    private static reformat(source: string, input: string, output: string): string | null {
        const m = moment(source, input);
        return m.isValid() ? m.format(output) : null;
    }
}
