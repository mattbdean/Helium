import { HttpErrorResponse } from '@angular/common/http';
import {
    AfterViewInit,
    Component, Input, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { MatPaginator, MatSnackBar, MatSort } from '@angular/material';
import { Router } from '@angular/router';
import { clone, groupBy } from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject, Observable, Subscription } from 'rxjs/Rx';
import {
    Constraint, Filter, TableMeta
} from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name.class';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { FilterManagerComponent } from '../filter-manager/filter-manager.component';

@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements AfterViewInit, OnInit, OnDestroy {
    private static readonly DISPLAY_FORMAT_DATE = 'l';
    private static readonly DISPLAY_FORMAT_DATETIME = 'LLL';

    @Input()
    public set name(value: TableName) { this.name$.next(value); }
    public get name() { return this.name$.getValue()!!; }

    public get meta() { return this.meta$.getValue()!!; }

    public columnNames: string[] = [];

    public constraints: { [colName: string]: Constraint[] };

    /**
     * The different amount of rows to display at a time the user may choose
     * from
     */
    public pageSizeOptions = [5, 10, 25, 100];

    /** The amount of rows to show per page */
    public pageSize = 25;

    /** The amount of rows available with the given filters */
    public totalRows = 0;

    /** FilterManagerComponent will be visible when this is true */
    public showFilters = false;

    /** If the table could be found */
    public tableExists = true;

    private nameSub: Subscription;

    @ViewChild(FilterManagerComponent) private filterManager: FilterManagerComponent;
    @ViewChild(MatPaginator) private matPaginator: MatPaginator;
    @ViewChild(MatSort) private matSort: MatSort;

    /** An observable that keeps track of the table name */
    private name$ = new BehaviorSubject<TableName | null>(null);
    private meta$ = new BehaviorSubject<TableMeta | null>(null);

    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
        private backend: TableService,
        private dataSource: ApiDataSource
    ) {}

    public ngOnInit(): void {
        this.nameSub = this.name$
            .distinctUntilChanged()
            .filter((n) => n !== null)
            .map((m) => m!!)
            .switchMap((name) =>
                this.backend.meta(name.schema, name.name.raw)
                    .catch((err: HttpErrorResponse) => {
                        if (err.status !== 404) {
                            // TODO: Unexpected errors could be handled more
                            // gracefully
                            throw err;
                        }

                        this.tableExists = false;
                        return Observable.never();
                    }))
            .subscribe((meta: TableMeta) => {
                const names = meta.headers.map((h) => h.name);

                // Add the "insert like" row
                names.unshift('__insertLike');
                this.columnNames = names;

                this.constraints = groupBy(meta.constraints, (c) => c.localColumn);

                // Update observables and data source
                this.meta$.next(meta);
                this.dataSource.switchTables(meta);
            });
    }

    public ngAfterViewInit(): void {
        this.dataSource.init({
            paginator: this.matPaginator,
            sort: this.matSort,
            filters: this.filterManager
        });
    }

    public ngOnDestroy(): void {
        // Clean up our subscriptions
        this.nameSub.unsubscribe();
    }

    public onInsertLike(row: object) {
        return this.router.navigate(['/forms', this.name.schema, this.name.name.raw], {
            queryParams: this.createQueryParams(row)
        });
    }

    public onFiltersChanged(filters: Filter[]) {
        // Only hide if going from 1 to 0 filters
        if (filters.length === 0 && this.filterManager.visibleFilters === 0)
            this.showFilters = false;
    }

    public toggleFilters() {
        this.showFilters = !this.showFilters;
        if (this.showFilters && this.filterManager.visibleFilters === 0) {
            this.filterManager.addFilter();
        }
    }

    public isBlob(headerName: string) {
        const header = this.meta.headers.find((h) => h.name === headerName);
        return header === undefined ? false : header.type === 'blob';
    }

    private createQueryParams(row: object) {
        const reformatted = clone(row);

        // Ignore the "insert like" header
        delete reformatted['__insertLike'];

        // Find all date and datetime headers and transform them from their
        // display format to the API format
        for (const headerName of Object.keys(reformatted)) {

            const header = this.meta$.getValue()!!.headers.find((h) => h.name === headerName);
            if (header === undefined)
                throw new Error('Can\'t find header with name ' + headerName);

            // We only need to provide the next component what information
            // uniquely identifies this row
            const primaryKey = this.meta$.getValue()!!.constraints.find((c) =>
                c.localColumn === header.name && c.type === 'primary');

            // We don't care about anything besides primary keys
            if (primaryKey === undefined) {
                delete reformatted[headerName];
                // If we don't continue here reformatted[headerName] will be
                // added back into the object if the header is a date or
                // datetime
                continue;
            }

            if (header.type === 'date')
                reformatted[headerName] = moment(reformatted[headerName],
                    DatatableComponent.DISPLAY_FORMAT_DATE).format(DATE_FORMAT);
            if (header.type === 'datetime')
                reformatted[headerName] = moment(reformatted[headerName],
                    DatatableComponent.DISPLAY_FORMAT_DATETIME).format(DATETIME_FORMAT);
        }

        return { row: JSON.stringify(reformatted) };
    }
}
