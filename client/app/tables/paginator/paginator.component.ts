import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material';
import { BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { InstantErrorStateMatcher } from '../../core/instant-error-state-matcher/instant-error-state-matcher';
import { PageEventPatch } from './page-event-patch';
import { pageIndexValidator } from './page-index.validator';

/**
 * The PaginatorComponent wraps a MatPaginator with a little extra flair. There
 * is an additional text input which can be used to type out a page number
 * instead of clicking a bunch of times to get to the page the user wants.
 * 
 * The properties are mostly the same as MatPaginator's. Changing the pageIndex,
 * pageSize or totalRows will emit an event through `page`.
 */
@Component({
    selector: 'paginator',
    templateUrl: 'paginator.component.html',
    styleUrls: ['paginator.component.scss']
})
export class PaginatorComponent implements OnInit, AfterViewInit {
    public static readonly DEFAULT_PAGE_SIZE = 25;

    /** The amount of rows to show per page */
    @Input()
    public get pageSize() { return this.page$.getValue().pageSize; }
    public set pageSize(size: number) {
        this.matPaginator.pageSize = size;
        this.emitPageEventPatch({ pageSize: size });
    }

    /**
     * The different amount of rows to display at a time the user may choose
     * from
     */
    @Input()
    public pageSizeOptions: number[] = [5, 10, 25, 100];

    /**
     * Emitted when the the page, the total length, or the page size is changed
     * through this component.
     */
    @Output()
    public page = new EventEmitter<PageEvent>();

    /**
     * The total amount of rows that is able to be paginated over
     */
    public get totalRows() { return this.page$.getValue().length; }
    public set totalRows(rows: number) {
        this.matPaginator.length = rows;
        this.emitPageEventPatch({ length: rows });
    }

    /**
     * The current page index. First page is 0.
     */
    public get pageIndex() { return this.page$.getValue().pageIndex; }
    public set pageIndex(index: number) {
        const previousPageIndex = this.pageIndex;
        this.group.setValue({ page: index + 1 });
        this.emitPageEventPatch({
            previousPageIndex,
            pageIndex: index
        });
    }

    /**
     * Show errors immediately on the page number input instead of waiting for
     * the input to be blurred and having the user wonder why it's not updating
     * the page
     */
    public pageErrorStateMatcher = new InstantErrorStateMatcher();

    /**
     * The FormGroup that handles manual page selection. The only child of this
     * group is that input.
     */
    public group: FormGroup;

    @ViewChild(MatPaginator)
    private matPaginator: MatPaginator;

    private page$ = new BehaviorSubject<PageEvent>({
        pageIndex: 0,
        pageSize: PaginatorComponent.DEFAULT_PAGE_SIZE,
        previousPageIndex: 0,
        length: 0
    });

    public ngOnInit(): void {
        this.group = new FormGroup({
            page: new FormControl(1)
        });
    }

    public ngAfterViewInit(): void {
        // Detect changing the page or page size via MatPaginator
        this.matPaginator.page.pipe(
            filter((event: PageEvent) => event.pageIndex !== this.pageIndex || event.pageSize !== this.pageSize)
        ).subscribe((eventWithNewData: PageEvent) => {
            // Make a copy of the current page data
            const eventPatch: Partial<PageEvent> = {};

            // The page index might have changed
            eventPatch.pageIndex = eventWithNewData.pageIndex;
            this.group.setValue({ page: eventPatch.pageIndex + 1 });

            // The page size might have changed. Update the @Input() property
            // as well as the new event data
            this.pageSize = eventWithNewData.pageSize;
            eventPatch.pageSize = eventWithNewData.pageSize;

            // Finally, emit the event
            this.emitPageEventPatch(eventPatch);
        });

        const maxPage = this.page$.pipe(
            map((event: PageEvent) => Math.ceil(event.length / event.pageSize))
        );

        const pageControl = this.group.get('page')!!;
        pageControl.setAsyncValidators(pageIndexValidator(maxPage));

        // We have to use statusChanges instead of valueChanges since the async
        // validator will make the control have a status of PENDING immediately
        // after the value change is emitted. This way, we only pick up on the
        // value after the async validator has completed.
        pageControl.statusChanges.pipe(
            filter((status) => status === 'VALID'),
            // -1 since this control is the page number, not the page index
            map(() => parseInt((pageControl.value), 10) - 1),
            debounceTime(200),
            distinctUntilChanged()
        ).subscribe((pageIndex) => {
            this.pageIndex = pageIndex;
            this.matPaginator.pageIndex = pageIndex;
        });
    }

    /**
     * Emits a new page event with the properties given from the given patch.
     * Undefined properties will be assigned a value from this.page$.getValue()
     * of the same name. For example, to change only the page size and keep all
     * other values the same:
     * 
     * emitPageEventPatch({ pageSize: 100 })
     * 
     * Calling this method with an empty object will emit no events.
     */
    private emitPageEventPatch(patch: Partial<PageEvent>) {
        const newEvent = new PageEventPatch(patch).applyTo(this.page$.getValue());
        if (newEvent !== null) {
            this.page.emit(newEvent);
            this.page$.next(newEvent);
        }
    }
}
