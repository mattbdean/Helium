import { ParamMap } from '@angular/router';
import { expect } from 'chai';
import { FilterOperation } from '../../../../common/api';
import { TableMeta } from '../../common/api';
import { PaginatorComponent } from '../paginator/paginator.component';
import { TableState, TableStateParams } from './table-state';

/** Creates a very simple ParamMap */
export const paramMap = (data: { [key: string]: string }): ParamMap => ({
    has: (name: string) => data[name] !== undefined,
    get: (name: string) => data[name] ? data[name] : null,
    getAll: (name: string) => data[name] ? [data[name]] : [],
    keys: Object.keys(data)
});

describe('TableState', () => {
    describe('toQuery', () => {
        it('should serialize complex data', () => {
            const initData = new TableState({
                page: 3,
                pageSize: 100,
                filters: [{ param: 'foo', op: 'eq', value: 'bar' }],
                sort: { direction: 'desc', active: 'baz' }
            });

            expect(initData.toQuery()).to.deep.equal({
                page: 3,
                pageSize: 100,
                filters: JSON.stringify(initData.filters),
                sort: '-baz'
            });
        });
    });

    describe('fromQuery', () => {
        it('should decode data produced by toQuery', () => {
            const initData = new TableState({
                page: 3,
                pageSize: 100,
                filters: [{ param: 'foo', op: 'eq', value: 'bar' }],
                sort: { direction: 'asc', active: 'baz' }
            });

            expect(TableState.fromQuery(paramMap(initData.toQuery()))).to.deep.equal(initData);
        });

        it('should not accept malformed JSON for filters', () => {
            const parseFilters = (json: string) => TableState.fromQuery(paramMap({ filters: json })).filters;
            const invalid = [
                '&^2', // not JSON
                '{}', // not an array
                '[]', // empty array
                JSON.stringify([{ param: 'foo', op: 'foo' }]), // missing 'value'
                JSON.stringify([{ param: 'foo', value: 'foo' }]), // missing 'op'
                JSON.stringify([{ op: 'foo', value: 'foo' }]), // missing 'param'
                JSON.stringify([{ param: 1, op: 'foo', value: 'foo' }]), // param not a string
                JSON.stringify([{ param: 'foo', op: 1, value: 'foo' }]), // op not a string
                JSON.stringify([{ param: 'foo', op: 'foo', value: 1 }]), // value not a string
                JSON.stringify([{ param: 'foo', op: 'foo', value: 'foo', extra: 'foo' }]) // extra property
            ];

            for (const invalidJson of invalid) {
                expect(parseFilters(invalidJson)).to.be.undefined;
            }
        });
    });

    describe('validateAgainst', () => {
        // Use randomly-picked values so that we make sure that validateAgainst
        // actually pulls from these defaults
        const defaults: TableStateParams = {
            filters: [{
                op: 'eq',
                param: 'some_column',
                value: 'some_value'
            }],
            page: 143214,
            pageSize: 4314212,
            sort: { active: 'fdsfa', direction: 'asc' }
        };

        it('should use the page size if it\'s not one of the provided options', () => {
            const initData = new TableState({ pageSize: 15 });
            expect(initData.validateAgainst({
                meta: {} as TableMeta,
                pageSizeOptions: [25, 50, 100],
                
                ops: [],
                defaults
            }).pageSize).to.equal(defaults.pageSize);
        });
        
        it('should exclude page if it\'s an invalid page number', () => {
            const tableMeta = { totalRows: 100 } as TableMeta;
            const validate = (page: number) => {
                return new TableState({ page }).validateAgainst({
                    meta: tableMeta,
                    pageSizeOptions: [25],
                    ops: [],
                    defaults
                });
            };
            
            const maxPage = Math.ceil(tableMeta.totalRows / PaginatorComponent.DEFAULT_PAGE_SIZE);

            // Anything less than 1 or greater than maxPage should not be valid
            expect(validate(0).page).to.equal(defaults.page);
            expect(validate(maxPage + 1).page).to.equal(defaults.page);

            // Anything between 1 and maxPage (inclusive) should be valid
            expect(validate(1).page).to.equal(1);
            expect(validate(maxPage).page).to.equal(maxPage);
        });

        it('should exclude individual filters if they aren\'t the name of a column', () => {
            const meta = {
                headers: [{
                    name: 'foo'
                }]
            } as TableMeta;

            const data = new TableState({
                filters: [
                    // this one is fine
                    { param: 'foo', op: 'eq', value: 'hello' },
                    // 'op' is invalid
                    { param: 'foo', op: 'bar' as FilterOperation, value: 'hello' },
                    // no header called 'baz'
                    { param: 'baz', op: 'eq', value: 'goodbye' }
                ]
            });

            expect(data.validateAgainst({
                meta,
                pageSizeOptions: [],
                ops: ['eq'],
                defaults
            }).filters).to.deep.equal([
                { param: 'foo', op: 'eq', value: 'hello' }
            ]);
        });

        it('should exclude the sorting if it doesn\'t reference a column in the metadata', () => {
            const meta = {
                headers: [{
                    name: 'foo'
                }]
            } as TableMeta;

            const data = new TableState({
                sort: { active: 'bar', direction: 'asc' }
            });

            expect(data.validateAgainst({
                meta,
                pageSizeOptions: [],
                ops: [],
                defaults
            }).sort).to.equal(defaults.sort);
        });
    });
});
