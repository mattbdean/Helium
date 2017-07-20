import { Component, Input, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Response } from '@angular/http';
import { BehaviorSubject, Observable, Subscription } from 'rxjs/Rx';

import * as _ from 'lodash';
import * as moment from 'moment';

import {
    Constraint, ConstraintType, SqlRow, TableHeader, TableMeta
} from '../common/responses';
import { BOOLEAN_TYPE } from '../core/constants';
import { TableService } from '../core/table.service';

interface ConstraintGrouping {
    [headerName: string]: Constraint[];
}

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
    private _name$ = new BehaviorSubject("");
    private _pageNumber$ = new BehaviorSubject(1);
    private _sort$ = new BehaviorSubject(undefined);

    @Input()
    public set name(value) { this._name$.next(value); }
    public get name() { return this._name$.getValue(); }

    private set pageNumber(value) { this._pageNumber$.next(value); }
    private get pageNumber() { return this._pageNumber$.getValue(); }

    private set sort(value) { this._sort$.next(value); }

    private nameSub: Subscription;
    private pageInfoSub: Subscription;

    private meta: TableMeta = {
        headers: [],
        totalRows: 0,
        constraints: [],
        comment: ''
    };
    private tableHeaders: DataTableHeader[];
    private constraints: ConstraintGrouping = {};

    private loading = false;

    @ViewChild('headerTemplate') private headerTemplate: TemplateRef<any>;
    @ViewChild('cellTemplate') private cellTemplate: TemplateRef<any>;

    /** True if this component has tried to access the table and found data */
    private exists: boolean = true;

    /** How many rows to fetch per page */
    private readonly limit: number = 25;

    private data: SqlRow[] = [];

    constructor(
        private backend: TableService
    ) {}

    public ngOnInit(): void {
        this.nameSub = this._name$
            .distinctUntilChanged()
            .do(() => { this.loading = true; })
            .switchMap((newName) => {
                // Create a disposable Observable so we don't end up completing
                // the main one. This way, if an error occurs, we can still
                // react to changes in the table name
                return this.backend.meta(newName)
                    .catch((err) => {
                        if (err instanceof Response && err.status === 404) {
                            // Handle 404s, show the user that the table couldn't be
                            // found
                            return Observable.of(null);
                        } else {
                            // Unknown error
                            throw err;
                        }
                    });
            })
            .subscribe((meta: TableMeta | null) => {
                this.loading = false;
                this.exists = meta !== null;
                if (meta !== null) {
                    this.meta = meta;
                    this.tableHeaders = this.createTableHeaders(this.meta.headers);
                    this.constraints = _.groupBy(this.meta.constraints, 'localColumn');
                    this.pageNumber = 1;
                }
            });

        this.pageInfoSub = Observable
            // Take the latest pageNumber and sort and transform them into an
            // object
            .combineLatest(
                this._pageNumber$,
                this._sort$,
                (pageNumber: number, sort: string) => ({
                    pageNumber,
                    sort
                })
            )
            // Make sure we're only requesting data stemming from filters
            // different from the previous one
            .distinctUntilChanged()
            .do(() => { this.loading = true; })
            .switchMap((args: any) => {
                return this.backend.content(this.name, args.pageNumber, this.limit, args.sort)
                    .catch((err) => {
                        // TODO handle this properly
                        throw err;
                    })
                    .map((rows: SqlRow[]) => this.formatRows(this.meta.headers, rows));
            })
            .subscribe((data: SqlRow[]) => {
                this.loading = false;
                this.data = data;
            });
    }

    public ngOnDestroy(): void {
        // Clean up our subscriptions
        this.nameSub.unsubscribe();
        this.pageInfoSub.unsubscribe();
    }

    private onPaginate(event: any) {
        // page 1 === offset 0, page 2 === offset 1, etc.
        this.pageNumber = event.offset + 1;
    }

    private onSort(event: any) {
        const sortDirPrefix = event.sorts[0].dir === 'desc' ? '-' : '';
        // '-prop' for descending, 'prop' for ascending
        this.sort = sortDirPrefix + event.sorts[0].prop;
    }

    private createTableHeaders(headers: TableHeader[]): DataTableHeader[] {
        return _.sortBy(_.map(headers, (h) => ({ 
            name: h.name,
            prop: h.name,
            cellTemplate: this.cellTemplate,
            headerTemplate: this.headerTemplate
        })), 'ordinalPosition');
    }

    private formatRows(headers: TableHeader[], rows: SqlRow[]): SqlRow[] {
        const copied = _.clone(rows);

        // Iterate through each row
        for (const row of copied) {
            // Iterate through each cell in that row
            for (const headerName of Object.keys(row)) {
                const header = _.find(headers, (h) => h.name === headerName);
                // Use moment to format dates and times in the default format
                if (header.type === 'date')
                    row[headerName] = DatatableComponent.formatMoment(row[headerName], 'l');
                if (header.type === 'timestamp' || header.type === 'datetime')
                    row[headerName] = DatatableComponent.formatMoment(row[headerName], 'LLL');
                if (header.rawType === BOOLEAN_TYPE)
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
     * @param format Any format accepted by Moment
     */
    private static formatMoment(source: string, format: string): string | null {
        const m = moment(source);
        return m.isValid() ? m.format(format) : null;
    }
}
