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
    MatSort
} from '@angular/material';
import { Router } from '@angular/router';
import { clone, groupBy, max, sum } from 'lodash';
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

@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements AfterViewInit, OnInit, OnDestroy {
    private static readonly DISPLAY_FORMAT_DATE = 'l';
    private static readonly DISPLAY_FORMAT_DATETIME = 'LLL';
    private static readonly MIN_ABS_COL_WIDTH = 10; // px
    private static readonly MIN_DEFAULT_COL_WIDTH = 100; // px
    private static readonly INSERT_LIKE_WIDTH = 40; // px

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

    private nameSub: Subscription;
    private layoutSub: Subscription;

    @ViewChild(FilterManagerComponent) private filterManager: FilterManagerComponent;
    @ViewChild(MatPaginator) private matPaginator: MatPaginator;
    @ViewChild(MatSort) private matSort: MatSort;

    @ViewChild('tableContainer') private tableContainer: ElementRef;
    @ViewChildren(MatHeaderCell, { read: ElementRef }) private headerCells: QueryList<ElementRef>;
    @ViewChildren(MatCell, { read: ElementRef }) private contentCells: QueryList<ElementRef>;

    /** An observable that keeps track of the table name */
    private name$ = new BehaviorSubject<TableName | null>(null);
    private meta$ = new BehaviorSubject<TableMeta | null>(null);

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
    }

    public ngAfterViewInit(): void {
        this.dataSource.init({
            paginator: this.matPaginator,
            sort: this.matSort,
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

        this.renderer.listen('body', 'mousemove', (event) => {
            if (this.resizeData.pressed) {
                this.resizeData.endX = event.x;
                console.log(this.resizeData);
            }
        });

        this.renderer.listen('body', 'mouseup', (event) => {
            if (this.resizeData.pressed) {
                this.resizeData.pressed = false;

                if (this.resizeData.startX !== this.resizeData.endX) {
                    // Don't allow the width to be below a certain value
                    const newWidth = Math.max(
                        this.resizeData.startWidth + (this.resizeData.endX - this.resizeData.startX),
                        DatatableComponent.MIN_ABS_COL_WIDTH
                    );

                    // Resize the column
                    this.resizeColumn(this.resizeData.colIndex, newWidth);
                }
            }
        });
    }

    public onResizerMouseDown(event: MouseEvent) {
        let headerElement: any = event.target;

        // Recursively navigate up the DOM to find the header cell
        while (headerElement.nodeName.toLowerCase() !== 'mat-header-cell') {
            headerElement = headerElement.parentElement;
        }

        headerElement = headerElement.previousSibling;

        let colIndex = 0;

        // Find the column index by counting how many siblings came before this
        // header
        let tmp = headerElement.previousSibling;
        while (tmp !== null) {
            tmp = tmp.previousSibling;
            colIndex++;
        }

        this.resizeData = {
            pressed: true,
            startX: event.x,
            startWidth: headerElement.clientWidth,
            endX: event.x,
            colIndex
        };
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
            // the cells we're looking for start at index (rows * colIndex).
            this.renderer.setStyle(cells[(rows * colIndex) + i], 'width', newWidth + 'px');
        }

        // Don't forget about the header
        this.renderer.setStyle(this.headerCells.toArray()[colIndex].nativeElement, 'width', newWidth + 'px');
    }

    private recalculateTableLayout(headerList: QueryList<any>, bodyList: QueryList<any>) {
        const allCells = headerList.toArray().concat(bodyList.toArray())
            .map((ref) => ref.nativeElement)
            .filter((el) => !el.classList.contains('insert-like-col'));

        // -1 for the "insert like" header
        const numHeaders = headerList.length - 1;
        const numRows = (allCells.length / numHeaders) - 1;

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
            table[Math.floor(j / numRows)].push(columnCells[j]);
        }

        // Compute the maximum width of each column
        const requiredWidths = table
            .map((col: any[]) => col.map((el) => Math.max(el.clientWidth, DatatableComponent.MIN_DEFAULT_COL_WIDTH)))
            .map(max);

        // Determine the padding on the left and right sides of each row
        const padding = Number(window.getComputedStyle(document.querySelector('mat-header-row')!!)
            .getPropertyValue('padding-left')
            // Very brittle solution, will fall apart if Angular Material
            // decides to use any other unit besides pixels
            .replace('px', ''));

        // Determine the amount of space given to us to render the table
        const allottedWidth = this.tableContainer.nativeElement.clientWidth
            - DatatableComponent.INSERT_LIKE_WIDTH
            - (padding * 2);

        const totalRequiredWidth = sum(requiredWidths);

        if (totalRequiredWidth < allottedWidth) {
            // We have an abundance of space, distribute everything evenly
            const width = allottedWidth / numHeaders;
            for (const col of table) {
                for (const el of col) {
                    this.renderer.setStyle(el, 'width', width + 'px');
                }
            }
        } else {
            // We have a shortage of space, make each column take up only what
            // is required
            for (let i = 0; i < table.length; i++) {
                for (const el of table[i]) {
                    this.renderer.setStyle(el, 'width', requiredWidths[i] + 'px');
                }
            }
        }
    }
}
