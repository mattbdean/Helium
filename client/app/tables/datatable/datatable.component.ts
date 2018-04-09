import { CollectionViewer } from '@angular/cdk/collections';
import { HttpErrorResponse } from '@angular/common/http';
import {
    AfterViewInit,
    Component, ElementRef, Input, OnDestroy, OnInit, QueryList, Renderer2,
    ViewChild,
    ViewChildren
} from '@angular/core';
import {
    MatCell,
    MatHeaderCell, MatPaginator, MatSnackBar,
    MatSort, Sort
} from '@angular/material';
import { Router } from '@angular/router';
import { clone, groupBy, max } from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject, Observable, Subscription } from 'rxjs/Rx';
import {
    Constraint, Filter, SqlRow, TableMeta
} from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name.class';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { FilterManagerComponent } from '../filter-manager/filter-manager.component';
import { SortIndicatorComponent } from '../sort-indicator/sort-indicator.component';

@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements AfterViewInit, OnInit, OnDestroy {
    private static readonly DISPLAY_FORMAT_DATE = 'l';
    private static readonly DISPLAY_FORMAT_DATETIME = 'LLL';
    private static readonly MIN_DEFAULT_COL_WIDTH = 50; // px
    private static readonly INSERT_LIKE_COL_WIDTH = 35; // px

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

    public resizeData: {
        startX: number,
        startWidth: number,
        endX: number,

        /** If the mouse is currently down */
        pressed: boolean,

        /** Target column index. Includes the "insert like" column. */
        colIndex: number
    } = {
        startX: 0,
        startWidth: 0,
        pressed: false,
        endX: 0,
        colIndex: -1
    };

    private get displayedRows() {
        // -1 because otherwise it would include the header row
        return ((this.contentCells.length + this.headerCells.length) / this.headerCells.length) - 1;
    }

    private widths: number[] = [];
    private minWidths: number[] = [];

    /**
     * True if the user has switched to a new table and it hasn't had an initial
     * layout calculation. Layout recalculation is only done once per table
     * switch.
     */
    private needsFullLayoutRecalculation = false;

    private nameSub: Subscription;
    private layoutSub: Subscription;
    private recalcSub: Subscription;

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
        private renderer: Renderer2
    ) {}

    public ngOnInit(): void {
        this.nameSub = this.name$
            .filter((n) => n !== null)
            .map((m) => m!!)
            .do(() => { this.loading = true; })
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
                if (this.matPaginator)
                    this.matPaginator.pageIndex = 0;
                this.loading = false;
            });

        this.recalcSub = this.name$
            .distinctUntilChanged()
            .subscribe(() => {
                this.needsFullLayoutRecalculation = true;
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
             viewChange: Observable.of({ start: 0, end: Number.MAX_VALUE })
        };

        // For some unknown reason this callback is always fired after all cells
        // have properly rendered.
        this.layoutSub = this.dataSource.connect(fakeCollectionViewer).subscribe((data: SqlRow[]) => {
            this.matPaginator.length = data.length;
            this.recalculateTableLayout(this.headerCells, this.contentCells);
        });

        const calculateWidth = () => Math.max(
            // Don't allow the width to be below a certain value
            this.resizeData.startWidth + (this.resizeData.endX - this.resizeData.startX),
            this.minWidths!![this.resizeData.colIndex]
        );

        this.renderer.listen('body', 'mousemove', (event) => {
            if (this.resizeData.pressed) {
                this.resizeData.endX = event.x;

                this.resizeHeader(this.resizeData.colIndex, calculateWidth());
            }
        });

        this.renderer.listen('body', 'mouseup', (event) => {
            if (this.resizeData.pressed) {
                if (this.resizeData.startX !== this.resizeData.endX) {

                    // Resize the column
                    this.resizeColumn(this.resizeData.colIndex, calculateWidth());
                }

                setTimeout(() => {
                    this.resizeData.pressed = false;
                }, 0);
            }
        });

        this.renderer.listen('body', 'mouseleave', () => {
            if (this.resizeData.pressed) {
                this.resizeData = {
                    startX: 0,
                    startWidth: 0,
                    pressed: false,
                    endX: 0,
                    colIndex: -1
                };
            }
        });
    }

    public onResizerMouseDown(event: MouseEvent) {
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

        this.resizeData = {
            pressed: true,
            startX: event.x,
            startWidth: headerElement.clientWidth,
            endX: event.x,
            colIndex
        };
    }

    public onSortRequested(colIndex: number) {
        if (this.resizeData.pressed)
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
        const rows = this.displayedRows;

        for (let i = 0; i < rows; i++) {
            // Content cells are listed column by column from left to right, so
            // the cells we're looking for start at index (rows * (colIndex - 1)).
            this.renderer.setStyle(cells[(rows * colIndex) + i], 'width', newWidth + 'px');
        }

        // Don't forget about the header
        this.resizeHeader(colIndex, newWidth);

        this.widths[colIndex] = newWidth;
    }

    private resizeHeader(colIndex: number, newWidth: number) {
        this.renderer.setStyle(this.headerCells.toArray()[colIndex].nativeElement, 'width', newWidth + 'px');
    }

    private recalculateTableLayout(headerList: QueryList<any>, bodyList: QueryList<any>) {
        const allCells = headerList.toArray().concat(bodyList.toArray())
            .map((ref) => ref.nativeElement);

        const numHeaders = headerList.length;
        const numRows = (allCells.length / numHeaders);

        // Create a 2d array in which the first dimension is a column
        // and the second dimension is a cell in a column
        const table: any[][] = [];

        // Headers are listed first
        const headers = allCells.slice(0, numHeaders);

        // Initialize the 2d array such that no elements are undefined
        for (let i = 0; i < headers.length; i++) {
            table[i] = [headers[i]];
        }

        // Header cells are listed left to right, but data cells are listed top
        // to bottom first, and then left to right. Basically the first column
        // on the left is listed top down first, followed by the rest of the
        // columns in that same order
        const columnCells = allCells.slice(numHeaders);
        for (let j = 0; j < columnCells.length; j++) {
            table[Math.floor(j / (numRows - 1))].push(columnCells[j]);
        }

        if (this.needsFullLayoutRecalculation) {
            this.widths = table
                .map((col: any[]) =>
                    col.map((el) =>
                        Math.max(el.clientWidth, DatatableComponent.MIN_DEFAULT_COL_WIDTH)))
                .map(max) as number[];

            // Compute the maximum width of each column
            this.minWidths = headers.map((h) => h.clientWidth);

            this.widths[0] = DatatableComponent.INSERT_LIKE_COL_WIDTH;
            this.minWidths[0] = DatatableComponent.INSERT_LIKE_COL_WIDTH;

            this.needsFullLayoutRecalculation = false;
        }

        // Make each column take up only what is required
        for (let i = 0; i < table.length; i++) {
            for (const el of table[i]) {
                this.renderer.setStyle(el, 'width', this.widths[i] + 'px');
            }
        }
    }
}
