import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { cloneDeep, isEqual } from 'lodash';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, first, map } from 'rxjs/operators';
import { TableState, TableStateParams } from './table-state';
import { TableStateStorage } from './table-state-storage';

/**
 * This class manages the datatable's state by saving to/loading from the
 * current URL's query.
 */
@Injectable()
export class QueryTableStateStorage extends TableStateStorage {
    public constructor(
        private route: ActivatedRoute,
        private router: Router
    ) {
        super();

        this.route.queryParamMap.pipe(
            first(),
            map(TableState.fromQuery)
        ).subscribe((state) => {
            this.current$.next(state);
        });

        this.current$.subscribe((state: TableState) => {
            // Create a query featuring only relevant information. Defaults
            // (like the page being 1) will not be encoded.
            this.router.navigate([], {
                queryParams: state.toQuery()
            });
        });
    }
}
