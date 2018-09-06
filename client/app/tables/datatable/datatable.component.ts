import { HttpErrorResponse } from '@angular/common/http';
import {
    AfterViewInit, Component, ElementRef, EventEmitter, Injector, Input,
    OnDestroy, OnInit, Output, QueryList, Renderer2, ViewChild, ViewChildren
} from '@angular/core';
import { MatCell, MatHeaderCell, Sort, SortDirection } from '@angular/material';
import { ActivatedRoute, Router } from '@angular/router';
import { clone, flatten, groupBy, isEqual } from 'lodash';
import * as moment from 'moment';
import { BehaviorSubject, combineLatest, NEVER, Observable, of, Subscription, zip } from 'rxjs';
import { catchError, distinctUntilChanged, filter, first, map, switchMap, tap } from 'rxjs/operators';
import { flattenCompoundConstraints } from '../../../../common/util';
import { environment } from '../../../environments/environment';
import { Constraint, Filter, SqlRow, TableMeta } from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { TableName } from '../../common/table-name';
import { ApiService } from '../../core/api/api.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { FilterManagerComponent } from '../filter-manager/filter-manager.component';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { LayoutHelper } from '../layout-helper/layout-helper';
import { PaginatorComponent } from '../paginator/paginator.component';
import { SortIndicatorComponent } from '../sort-indicator/sort-indicator.component';
import { NoopTableStateStorage } from './noop-table-state-storage';
import { QueryTableStateStorage } from './query-table-state-storage';
import { TableState, TableStateParams } from './table-state';
import { TableStateStorage } from './table-state-storage';

/**
 * This component is responsible for showing tabular data to the user.
 * 
 * Links to this component are made shareable by storing the data selectors into
 * the query. These data selectors include things like the page number, filters,
 * and sorting. This feature is only available if `saveState` is true.
 */
@Component({
    selector: 'datatable',
    templateUrl: 'datatable.component.html',
    styleUrls: ['datatable.component.scss']
})
export class DatatableComponent implements OnInit, AfterViewInit, OnDestroy {
    public static readonly DEFAULT_PAGE_SIZE = 25;
    private static readonly DISPLAY_FORMAT_DATE = 'l';
    private static readonly DISPLAY_FORMAT_DATETIME = 'LLL';

    @Input()
    public set name(value: TableName) { this.name$.next(value); }
    public get name() { return this.name$.getValue()!!; }

    /**
     * Determines if this component will allow the user to pick a row. Rows the
     * user clicks on while this property is true will be output through the
     * `rowSelected` emitter.
     */
    @Input()
    public allowSelection = false;

    @Input()
    public saveState = false;

    /** Outputs the value of the selected row if `selectionMode` is true. */
    @Output()
    public rowSelected: EventEmitter<{ row: SqlRow, table: TableMeta }> = new EventEmitter();

    public preview = environment.preview;

    public meta: TableMeta;

    public columnNames: string[] = [];

    public constraints: { [colName: string]: Constraint[] };

    public currentError: string | null = null;

    /** The amount of rows available with the given filters */
    public get totalRows(): number { return this.paginator ? this.paginator.totalRows : 0; }

    public get allowInsertLike() { return !this.allowSelection; }

    /** FilterManagerComponent will be visible when this is true */
    public showFilters = false;

    public loading = true;

    /**
     * True if the TableState has already been used to initialize this component
     */
    private initialStateLoaded = false;

    /**
     * How the state will be stored. Created based on the value of the
     * `saveState` input.
     */
    private stateStorage: TableStateStorage;

    private nameSub: Subscription | undefined;
    private layoutSub: Subscription | undefined;
    private recalcSub: Subscription | undefined;
    private headerCellsSub: Subscription | undefined;
    private stateWatcherSub: Subscription | undefined;

    @ViewChild(FilterManagerComponent) public filterManager: FilterManagerComponent;
    @ViewChild(PaginatorComponent) public paginator: PaginatorComponent;

    @ViewChildren(MatHeaderCell, { read: ElementRef }) private headerCells: QueryList<ElementRef>;
    @ViewChildren(MatCell, { read: ElementRef }) private contentCells: QueryList<ElementRef>;
    @ViewChildren(SortIndicatorComponent) private sortIndicators: QueryList<SortIndicatorComponent>;

    /** An observable that keeps track of the table name */
    private name$ = new BehaviorSubject<TableName | null>(null);
    private sort$ = new BehaviorSubject<Sort>({ direction: '', active: '' });

    constructor(
        public dataSource: ApiDataSource,
        private backend: ApiService,
        private filterProvider: FilterProviderService,
        private injector: Injector,
        private layoutHelper: LayoutHelper,
        private renderer: Renderer2,
        private route: ActivatedRoute,
        private router: Router
    ) {}

    public ngOnInit() {
        this.stateStorage = this.injector.get(
            this.saveState ? QueryTableStateStorage : NoopTableStateStorage);
    }

    public ngAfterViewInit(): void {
        this.dataSource.init({
            paginator: this.paginator,
            sort: this.sort$,
            filters: this.filterManager,
            allowInsertLike: this.allowInsertLike
        });

        // For whatever reason, subscribing to the header cells causes the
        // dataSource subscription to always be fired after the cells have
        // updated in the DOM, which is what we want
        this.headerCellsSub = this.headerCells.changes.subscribe(() => void 0);

        this.layoutSub = combineLatest(
            this.headerCells.changes,
            this.contentCells.changes,
            this.dataSource.dataChanges()
        ).pipe(filter((data): boolean => {
            // The metadata hasn't loaded yet, guaranteed to not be ready for
            // recalculation yet
            if (!this.meta)
                return false;
            
            const [headers, content, tableData] = data;

            // Add 1 for the header row
            const expectedRows = tableData.length + 1;
            // Add 1 for the "insert like" column
            const expectedColumns = this.meta.headers.length + (this.allowInsertLike ? 1 : 0);

            // Angular Material updates the header cells first and then the
            // content cells, triggering two different updates. We want to
            // ignore the first update since the content cells aren't fully
            // loaded and recalculating the table layout at that stage would
            // cause rendering issues. Avoid this situation by making sure the
            // expected amount of cells to be rendered matches the actual amount
            // of rendered cells.
            return (expectedRows * expectedColumns) === headers.length + content.length;
        })).subscribe(() => {
            this.recalculateTableLayout();
        });

        this.layoutHelper.init(this.headerCells, this.contentCells, this.allowInsertLike);

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
        
        // Read page, page size, filters, and sort from query parameters.
        // Everything here is validated in regards to type only. Further
        // validation (eg page index too high) is done at another time.
        const initData$: Observable<TableState> = this.route.queryParamMap.pipe(
            // We only care about this data on initialization
            first(),
            map(TableState.fromQuery)
        );

        this.nameSub = this.name$.pipe(
            filter((n) => n !== null),
            map((m) => m!!),
            tap(() => { this.loading = true; }),
            switchMap((name) => this.backend.meta(name.schema, name.name.raw).pipe(
                catchError((err: HttpErrorResponse) => {
                    this.loading = false;
                    this.currentError = err.status === 404 ? 'Table not found' : err.error.error.message;
                    // Use an empty observable to stop here. There's probably a
                    // better way to do this that involves setting loading and
                    // currentError in the subscribe callback
                    return of();
                }))
            ),
            switchMap((meta: TableMeta): Observable<[TableMeta, TableState]> => {
                // Include the initialization data only on initialization (duh)
                const result = zip(of(meta), this.initialStateLoaded ? of(new TableState({})) : initData$);
                if (!this.initialStateLoaded)
                    this.initialStateLoaded = true;
                
                return result;
            })
        ).subscribe(([meta, unvalidatedInitData]) => {
            this.currentError = null;
            const names = meta.headers.map((h) => h.name);

            if (this.allowInsertLike)
                // Add the "insert like" row
                names.unshift('__insertLike');

            this.columnNames = names;

            const flattened = flatten(meta.constraints.map((c) => c.constraints));
            this.constraints = groupBy(flattened, (c) => c.localColumn);

            // Validate what was provided in the query against the data we
            // actually have
            const initialState = unvalidatedInitData.validateAgainst({
                meta,
                pageSizeOptions: this.paginator.pageSizeOptions,
                ops: this.filterProvider.operations().map((o) => o.codeName),
                defaults: {
                    filters: [],
                    page: 1,
                    pageSize: DatatableComponent.DEFAULT_PAGE_SIZE,
                    sort: undefined
                }
            });

            // Apply the initial TableState to the current state
            if (initialState.pageSize)
                this.paginator.pageSize = initialState.pageSize;
            if (initialState.page)
                this.paginator.pageIndex = initialState.page - 1;
            if (initialState.filters && initialState.filters.length > 0) {
                this.filterManager.preemptiveFilters = {
                    schema: meta.schema,
                    table: meta.name,
                    filters: initialState.filters
                };
                // Make it abundantly clear the data is being filtered
                this.showFilters = true;
            }
            if (initialState.sort) {
                // The SortIndicators aren't available until the table is
                // rendered, so listen for that
                this.sortIndicators.changes.pipe(
                    // We only care about the first change
                    first(),
                    map((ql: QueryList<SortIndicatorComponent>) => {
                        // The columns are rendered in the order they're
                        // listed in the TableMeta
                        const sortIndex = this.meta.headers.findIndex((h) => h.name === initialState.sort!!.active);
                        if (sortIndex < 0)
                            throw new Error('No column named "' + initialState.sort!!.active + '"');
                        return ql.toArray()[sortIndex];
                    })
                ).subscribe((comp) => {
                    // Update on next tick to avoid change detection issues
                    setTimeout(() => {
                        comp.state = initialState.sort!!.direction;
                    }, 0);
                    this.sort$.next(initialState.sort!!);
                });
            }

            // Update observables and data source
            this.meta = meta;
            this.dataSource.switchTables(meta);
            if (initialState.page === undefined)
                this.paginator.pageIndex = 0;
            this.loading = false;
        });

        this.recalcSub = this.name$
            .pipe(distinctUntilChanged())
            .subscribe(() => {
                this.layoutHelper.needsFullLayoutRecalculation = true;
            });

        this.stateWatcherSub = combineLatest(
            this.paginator.page.pipe(map((page) => page.pageIndex + 1)),
            this.paginator.page.pipe(map((page) => page.pageSize)),
            this.filterManager.changed,
            this.sort$
        ).pipe(
            distinctUntilChanged(isEqual),
            map(([page, pageSize, filters, sort]): TableStateParams => ({
                page,
                pageSize,
                filters,
                sort
            }))
        ).subscribe((state: TableStateParams) => {
            this.stateStorage.update(state);
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

    public onSortRequested(event: MouseEvent, colIndex: number) {
        // Avoid sorting when a foreign key icon is clicked, since that can
        // sometimes trigger sorting by the column that was just clicked after
        // the redirect, which will probably cause an error
        if (event.target !== null && event.target) {
            const target = event.target as any;
            let current = target;

            while (current !== null &&
                current.dataset &&
                current.dataset.constraintType !== 'foreign') {

                current = current.parentNode;
            }

            if (current !== null &&
                current.dataset &&
                current.dataset.constraintType === 'foreign') {

                return;
            }
        }

        // Prevent sorting when the user is currently resizing a column since
        // that probably isn't what they're trying to do
        if (this.layoutHelper.pressed)
            return;
        
        const index = this.allowInsertLike ? colIndex - 1 : colIndex;
        // If there are N columns (including the insert like column), then there
        // are N - 1 sortable columns.
        const indicators = this.sortIndicators.toArray();
        let sortDir: SortDirection | null = null;
        for (let i = 0; i < indicators.length; i++) {
            if (i === index) {
                sortDir = indicators[i].nextSort();
            } else {
                indicators[i].reset();
            }
        }

        if (sortDir === null)
            throw new Error('Could not determine new sort direction');

        const colName = this.columnNames[colIndex];
        this.sort$.next({ direction: sortDir, active: colName });
    }

    public ngOnDestroy(): void {
        // Clean up our subscriptions
        const subs = [
            this.nameSub,
            this.layoutSub,
            this.recalcSub,
            this.headerCellsSub,
            this.stateWatcherSub
        ];
        for (const sub of subs)
            if (sub)
                sub.unsubscribe();
    }

    public onInsertLike(row: object) {
        return this.router.navigate(['/forms', this.name.schema, this.name.name.raw], {
            queryParams: this.createQueryParams(row)
        });
    }

    public onRowClicked(row: SqlRow) {
        if (this.allowSelection) {
            this.rowSelected.next({ row, table: this.meta });
        }
    }

    /**
     * Called when there has been a change in the filters to be applied. Only
     * valid and enabled filters are provided.
     */
    public onFiltersChanged() {
        // If the page index isn't 0 and the filter excludes all data, the API
        // will return a 400 because the page is too high. Better be on the safe
        // side.
        this.paginator.pageIndex = 0;
    }

    /**
     * Called when the FilterManager has changed how many filter forms are
     * currently being displayed on the screen, regardless of if their validaity
     * or if they're disabled.
     */
    public onVisibleFiltersChanged(count: number) {
        if (count === 0)
            this.showFilters = false;
    }

    public toggleFilters() {
        this.showFilters = !this.showFilters;
        if (this.showFilters && this.filterManager.visibleFilters === 0) {
            this.filterManager.addFilter();
        }
    }

    public titleFor(headerName) {
        const header = this.meta.headers.find((h) => h.name === headerName);
        return header === undefined ? undefined : header.rawType;
    }

    public isBlob(headerName: string) {
        const header = this.meta.headers.find((h) => h.name === headerName);
        return header === undefined ? false : header.type === 'blob';
    }

    public allowResizingAndSorting(colIndex: number) {
        return this.allowInsertLike ? colIndex >= 1 : true;
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
            const header = this.meta.headers.find((h) => h.name === headerName);
            if (header === undefined)
                throw new Error('Can\'t find header with name ' + headerName);

            // We only need to provide the next component what information
            // uniquely identifies this row
            const flattened = flattenCompoundConstraints(this.meta.constraints);
            const primaryKey = flattened.find((c) =>
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

        return reformatted;
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
        const result = this.layoutHelper.recalculate((table) => {
            for (const row of table)
                for (const cell of row)
                    this.renderer.removeStyle(cell, 'width');
        });

        for (const { el, width } of result) {
            this.renderer.setStyle(el, 'width', width + 'px');
        }
    }
}
