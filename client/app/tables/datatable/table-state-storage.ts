import { cloneDeep, isEqual } from 'lodash';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { TableState, TableStateParams } from './table-state';

/**
 * This class manages the saving/loading of DatatableComponent's state. Members
 * of this state include:
 * 
 *  - page number
 *  - page size
 *  - sort
 *  - filters
 * 
 * See `TableStateParams` for a full list.
 * 
 * Only subclasses should be injected into components/directives.
 */
export class TableStateStorage {
    protected current$ = new BehaviorSubject<TableState>(new TableState({}));
    private change$: Observable<TableState>;

    public get change() { return this.change$; }

    public get value() { return this.current$.getValue(); }

    public constructor() {
        this.change$ = this.current$.pipe(
            distinctUntilChanged(isEqual)
        );
    }

    public update(data: Partial<TableStateParams>): TableState {
        const current = this.current$.getValue();

        // Assign/overwrite all properties of the Partial to the current state.
        const newData: Partial<TableStateParams> = Object.assign(cloneDeep(current), data);
        const newState = new TableState(newData);
        this.current$.next(newState);

        return newState;
    }
}
