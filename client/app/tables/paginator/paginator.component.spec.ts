import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule, MatInputModule, MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { expect } from 'chai';
import { take } from 'rxjs/operators';
import { PageEventPatch } from './page-event-patch';
import { PaginatorComponent } from './paginator.component';

describe('PaginatorComponent', () => {
    let fixture: ComponentFixture<PaginatorComponent>;
    let comp: PaginatorComponent;

    /** The value stored in PaginatorComponent.page$ when first initialized */
    const createInitialPageEvent = (): PageEvent => ({
        length: 0,
        pageIndex: 0,
        previousPageIndex: 0,
        pageSize: PaginatorComponent.DEFAULT_PAGE_SIZE
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatPaginatorModule,
                ReactiveFormsModule,
                MatInputModule,
                MatFormFieldModule,
                NoopAnimationsModule
            ],
            declarations: [
                PaginatorComponent
            ]
        });

        fixture = TestBed.createComponent(PaginatorComponent);
        comp = fixture.componentInstance;
    });

    // For whatever reason fakeAsync() doesn't work well with debounceTime so
    // I'm using a standard mocha async callback instead
    it('should emit an event via `page` when the page size, page index, or total rows changes', (done) => {
        let currentEvent = createInitialPageEvent();

        const expectedPatches: Array<Partial<PageEvent>> = [
            { pageSize: 100 },
            { pageIndex: 1, previousPageIndex: 0 },
            { length: 1000 }
        ];

        const emittedEvents: PageEvent[] = [];
        comp.page.pipe(
            // use take() to force completion, as it wouldn't otherwise
            take(expectedPatches.length)
        ).subscribe({
            next: (event) => {
                emittedEvents.push(event);
            },
            complete: () => {
                // Events aren't necessarily emitted in the order their
                // properties were changed. Even though pageSize is changed
                // before pageIndex, these patches are emitted in reverse order.
                // Make sure there were the right amount of events emitted and
                // then calculate the net result for each change.
                for (let i = 0; i < emittedEvents.length; i++) {
                    currentEvent = new PageEventPatch(expectedPatches[i]).applyTo(currentEvent)!!;
                }

                try {
                    expect(currentEvent).to.deep.equal(emittedEvents[emittedEvents.length - 1]);
                } catch (err) {
                    done(err);
                    return;
                }

                done();
            }
        });

        // Init the FormGroup, subscriptions, async validators, etc.
        fixture.detectChanges();

        // Cause the event emissions
        comp.pageSize = 100;
        comp.pageIndex = 1;
        comp.totalRows = 1000;
    });

    it('should not emit an event when the data doesn\'t change', (done) => {
        comp.page.subscribe((event) => {
            done(new Error('Should not have emitted data, got ' + JSON.stringify(event)));
        });

        fixture.detectChanges();
        comp.pageSize = comp.pageSize;
        comp.pageIndex = comp.pageIndex;
        comp.totalRows = comp.totalRows;

        // Wait a short period of time before giving up on catching an error
        setTimeout(done, 50);
    });

    it('should emit an event and update the page input when the page is updated via MatPaginator', (done) => {
        fixture.detectChanges();

        comp.page.pipe(
            take(1)
        ).subscribe((event) => {
            const expected = createInitialPageEvent();
            expected.pageIndex = 1;

            try {
                expect(event).to.deep.equal(expected);
                expect(comp.group.value).to.deep.equal({ page: 2 });
            } catch (err) {
                return done(err);
            }

            done();
        });

        const matPaginator = (comp as any).matPaginator as MatPaginator;
        matPaginator.pageIndex = 1;
        (matPaginator as any)._emitPageEvent(0);
    });

    describe('page input', () => {
        it('should emit an event whenever a valid page number is chosen via the input', (done) => {
            const totalRows = 100;
            const pageSize = 10;
            const receivedEvents: PageEvent[] = [];

            fixture.detectChanges();
            comp.pageSize = pageSize;
            comp.totalRows = totalRows;

            // Start listening after we set the page size and total rows so we don't
            // get those events too
            comp.page.pipe(
                // Only 1 event for the valid page
                take(1)
            ).subscribe({
                next: (event) => {
                    receivedEvents.push(event);
                },
                complete: () => {
                    try {
                        // Only 1 valid page given
                        expect(receivedEvents).to.have.lengthOf(1);
                    } catch (err) {
                        return done(err);
                    }

                    done();
                }
            });

            // Invalid
            comp.group.setValue({ page: 0 });
            comp.group.setValue({ page: Math.floor(totalRows / pageSize) + 1 });
            // Valid
            comp.group.setValue({ page: 2 });
        });
    });

    describe('pageIndex', () => {
        it('should update the page input when changed', fakeAsync(() => {
            fixture.detectChanges();

            comp.pageIndex = comp.pageIndex + 1;
            tick();

            expect(comp.group.value).to.deep.equal({ page: comp.pageIndex + 1 });
        }));
    });
});
