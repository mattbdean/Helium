import { fakeAsync, tick } from '@angular/core/testing';
import { expect } from 'chai';
import { TableState } from './table-state';
import { TableStateStorage } from './table-state-storage';

describe('TableStateStorage', () => {
    let store: TableStateStorage;

    beforeEach(() => {
        store = new TableStateStorage();
    });

    describe('update', () => {
        it('should return a new TableState based on the previous state', () => {
            expect(store.update({ page: 4 })).to.deep.equal(new TableState({
                page: 4,
                pageSize: undefined,
                filters: undefined,
                sort: undefined
            }));

            expect(store.update({ pageSize: 20 })).to.deep.equal(new TableState({
                page: 4,
                pageSize: 20,
                filters: undefined,
                sort: undefined
            }));
        });
    });

    describe('change', () => {
        it('should only emit distinct values', fakeAsync(() => {
            const emitted: TableState[] = [];
            store.change.subscribe((c) => emitted.push(c));

            store.update({ pageSize: 10 });
            store.update({});

            tick();
            expect(emitted).to.deep.equal([
                new TableState({}),
                new TableState({
                    pageSize: 10
                }),
            ]);
        }));
    });
});
