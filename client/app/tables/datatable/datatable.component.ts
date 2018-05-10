import { CollectionViewer } from '@angular/cdk/collections';
import { HttpErrorResponse } from '@angular/common/http';
import {
    AfterViewInit,
    Component, ElementRef, Input, OnDestroy, OnInit, QueryList, Renderer2,
    ViewChild,
    ViewChildren
} from '@angular/core';
import { MatCell, MatHeaderCell, MatPaginator, MatSnackBar, Sort } from '@angular/material';
import { Router } from '@angular/router';
import { clone, groupBy } from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject, NEVER, of, Subscription } from 'rxjs';
import {
    catchError,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    tap
} from 'rxjs/operators';
import {
    Constraint, Filter, SqlRow, TableMeta
} from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name.class';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { FilterManagerComponent } from '../filter-manager/filter-manager.component';
import { LayoutHelper } from '../layout-helper/layout-helper';
import { SortIndicatorComponent } from '../sort-indicator/sort-indicator.component';

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
    public get totalRows(): number { return this.matPaginator ? this.matPaginator.length : 0; }

    /** FilterManagerComponent will be visible when this is true */
    public showFilters = false;

    /** If the table could be found */
    public tableExists = true;

    public loading = true;

    private nameSub: Subscription;
    private layoutSub: Subscription;
    private recalcSub: Subscription;
    private headerCellsSub: Subscription;

    @ViewChild(FilterManagerComponent) private filterManager: FilterManagerComponent;
    @ViewChild(MatPaginator) private matPaginator: MatPaginator;

    @ViewChild('tableContainer') private tableContainer: ElementRef;
    @ViewChildren(MatHeaderCell, { read: ElementRef }) private headerCells: QueryList<ElementRef>;
    @ViewChildren(MatCell, { read: ElementRef }) private contentCells: QueryList<ElementRef>;
    @ViewChildren(SortIndicatorComponent) private sortIndicators: QueryList<SortIndicatorComponent>;

    /** An observable that keeps track of the table name */
    private name$ = new BehaviorSubject<TableName | null>(null);
    private meta$ = new BehaviorSubject<TableMeta | null>(null);
    private sort$ = new BehaviorSubject<Sort>({ direction: '', active: '' });

    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
        private backend: TableService,
        private dataSource: ApiDataSource,
        private renderer: Renderer2,
        private layoutHelper: LayoutHelper
    ) {}

    public ngOnInit(): void {
        this.nameSub = this.name$.pipe(
            filter((n) => n !== null),
            map((m) => m!!),
            tap(() => { this.loading = true; }),
            switchMap((name) =>
                this.backend.meta(name.schema, name.name.raw)
                    .pipe(catchError((err: HttpErrorResponse) => {
                        if (err.status !== 404) {
                            // TODO: Unexpected errors could be handled more
                            // gracefully
                            throw err;
                        }

                        this.tableExists = false;
                        return NEVER;
                    })))
        ).subscribe((meta: TableMeta) => {
                const names = meta.headers.map((h) => h.name);

                // Add the "insert like" row
                names.unshift('__insertLike');
                this.columnNames = names;

                this.constraints = groupBy(meta.constraints, (c) => c.localColumn);

                // Update observables and data source
                this.meta$.next(meta);
                this.dataSource.switchTables(meta);
                if (this.matPaginator)
                    this.matPaginator.pageIndex = 0;
                this.loading = false;
            });

        this.recalcSub = this.name$
            .pipe(distinctUntilChanged())
            .subscribe(() => {
                this.layoutHelper.needsFullLayoutRecalculation = true;
            });
    }

    public ngAfterViewInit(): void {
        this.dataSource.init({
            paginator: this.matPaginator,
            sort: this.sort$,
            filters: this.filterManager
        });

        const fakeCollectionViewer: CollectionViewer = {
            // This is actually pretty similar to what Angular Material gives us
            // as of v5.2.4
             viewChange: of({ start: 0, end: Number.MAX_VALUE })
        };

        // For whatever reason, subscribing to the header cells causes the
        // dataSource subscription to always be fired after the cells have
        // updated in the DOM, which is what we want
        this.headerCellsSub = this.headerCells.changes.subscribe(() => void 0);

        this.layoutSub = this.dataSource.connect(fakeCollectionViewer).subscribe((data: SqlRow[]) => {
            this.matPaginator.length = data.length;
            this.recalculateTableLayout();
        });

        this.layoutHelper.init(this.headerCells, this.contentCells);

        this.renderer.listen('body', 'mousemove', (event) => {
            if (this.layoutHelper.onMouseMove(event)) {
                this.resizeHeader(this.layoutHelper.state.colIndex, this.layoutHelper.newWidth());
            }
        });

        this.renderer.listen('body', 'mouseup', () => {
            if (this.layoutHelper.pressed) {
                const newWidth = this.layoutHelper.newWidth();
                if (newWidth > 0) {
                    // Resize the column
                    this.resizeColumn(this.layoutHelper.state.colIndex, newWidth);
                }

                this.layoutHelper.onDragEnd();
            }
        });

        this.renderer.listen('body', 'mouseleave', () => {
            const state = this.layoutHelper.state;
            this.layoutHelper.onMouseLeave();

            if (state.startX !== state.endX && state.colIndex >= 0) {
                this.resizeHeader(state.colIndex, this.layoutHelper.getWidth(state.colIndex));
            }
        });
    }

    public onResizerMouseDown(event: MouseEvent) {
        // We only care if the user used the primary button to start the drag
        if (event.button !== 0)
            return;

        let headerElement: any = event.target;

        // Recursively navigate up the DOM to find the header cell
        while (headerElement.nodeName.toLowerCase() !== 'mat-header-cell') {
            headerElement = headerElement.parentElement;
        }

        let colIndex = 0;

        // Find the column index by counting how many siblings came before this
        // header
        let tmp = headerElement.previousSibling;
        while (tmp !== null) {
            tmp = tmp.previousSibling;
            colIndex++;
        }

        colIndex--;

        this.layoutHelper.onDragStart(event, colIndex, headerElement.clientWidth);
    }

    public onSortRequested(colIndex: number) {
        if (this.layoutHelper.pressed)
            return;
        // If there are N columns (including the insert like column), then there
        // are N - 1 sortable columns.
        const sortDir = this.sortIndicators.toArray()[colIndex - 1].nextSort();
        const colName = this.columnNames[colIndex];
        this.sort$.next({ direction: sortDir, active: colName });
    }

    public ngOnDestroy(): void {
        // Clean up our subscriptions
        this.nameSub.unsubscribe();
        this.layoutSub.unsubscribe();
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

    public onResizerClick(event: MouseEvent) {
        // Prevent sorting when clicking directly on a resizer
        event.preventDefault();
        event.stopPropagation();
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

    private resizeColumn(colIndex: number, newWidth: number) {
        const cells = this.contentCells.toArray().map((elRef) => elRef.nativeElement);
        const rows = this.layoutHelper.contentRows;

        for (let i = 0; i < rows; i++) {
            // Content cells are listed column by column from left to right, so
            // the cells we're looking for start at index (rows * colIndex).
            this.renderer.setStyle(cells[(rows * colIndex) + i], 'width', newWidth + 'px');
        }

        // Don't forget about the header
        this.resizeHeader(colIndex, newWidth);

        this.layoutHelper.onResizeComplete(newWidth);
    }

    private resizeHeader(colIndex: number, newWidth: number) {
        this.renderer.setStyle(this.headerCells.toArray()[colIndex].nativeElement, 'width', newWidth + 'px');
    }

    private recalculateTableLayout() {
        const result = this.layoutHelper.recalculate();

        for (const { el, width } of result) {
            this.renderer.setStyle(el, 'width', width + 'px');
        }
    }
}
