import { Sort } from '@angular/material';
import { ParamMap, Params } from '@angular/router';
import { isEqual } from 'lodash';
import { FilterOperation } from '../../../../server/src/common/api';
import { Filter, TableMeta } from '../../common/api';
import { validateInteger } from '../paginator/page-index.validator';
import { PaginatorComponent } from '../paginator/paginator.component';

export interface InitDataParams {
    page?: number;
    pageSize?: number;
    filters?: Filter[];
    sort?: Sort;
}

/**
 * This class stores data used by DatatableComponent on initialization. The
 * basic lifecycle of this data is as follows:
 * 
 *  1. The user loads a page containing DatatableComponent
 *  2. When the user changes the page, page size, filters, or sorting, the query
 *     is updated with the current page, page size, filters, and sorting.
 *  3. If the page is refreshed, the DatatableComponent reads this data from the
 *     query and updates the data source to match the last known state.
 * 
 * A consequence of this is that now pages containing DatatableComponent are
 * shareable, as long as the other user has access to the table.
 */
export class InitData implements InitDataParams {
    /** Page number (1-indexed) */
    public readonly page?: number;
    public readonly pageSize?: number;
    public readonly filters?: Filter[];
    public readonly sort?: Sort;

    public constructor(params: InitDataParams) {
        this.page = params.page;
        this.pageSize = params.pageSize;
        this.filters = params.filters;
        this.sort = params.sort;
    }

    /**
     * Creates a new InitData with any aspect of data that doesn't match up with
     * the provided TableMeta, page size options, or filter operations unset.
     */
    public validateAgainst(meta: TableMeta, pageSizeOptions: number[], ops: FilterOperation[]): InitData {
        const validated: InitDataParams = {};
        if (this.pageSize && pageSizeOptions.includes(this.pageSize))
            validated.pageSize = this.pageSize;
        
        if (this.page && this.page > 0) {
            const pageSize = validated.pageSize ? validated.pageSize : PaginatorComponent.DEFAULT_PAGE_SIZE;
            const maxPage = Math.ceil(meta.totalRows / pageSize);
            if (this.page <= maxPage)
                validated.page = this.page;
        }

        if (this.filters) {
            const filters = this.validateFiltersAgainst(meta, ops);
            if (filters.length > 0)
                validated.filters = filters;
        }

        if (this.sort && meta.headers.find((h) => h.name === this.sort!!.active)) {
            validated.sort = this.sort;
        }

        return new InitData(validated);
    }

    /**
     * Produces a Params object that is able to recreate this object when passed
     * to InitData.fromQuery().
     */
    public toQuery(): Params {
        const query: any = {};
        if (this.page && this.page > 1)
            query.page = this.page;
        if (this.pageSize && this.pageSize !== PaginatorComponent.DEFAULT_PAGE_SIZE)
            query.pageSize = this.pageSize;
        if (this.filters && this.filters.length !== 0)
            query.filters = JSON.stringify(this.filters);
        if (this.sort && this.sort.direction !== '')
            query.sort = (this.sort.direction === 'desc' ? '-' : '') + this.sort.active;
        
        return query;
    }

    private validateFiltersAgainst(meta: TableMeta, ops: FilterOperation[]): Filter[] {
        if (this.filters === undefined)
            return [];

        const filters: Filter[] = [];

        for (const filter of this.filters) {
            if (!ops.includes(filter.op) || meta.headers.find((h) => h.name === filter.param) === undefined)
                continue;
            filters.push(filter);
        }

        return filters;
    }

    /**
     * Attempts to parse an InitData object from a ParamMap. Validates only the
     * shape of the data, not its actual contents. Use `validateAgainst` for
     * complete validation.
     */
    public static fromQuery(query: ParamMap): InitData {
        // Prefer a ParamMap over a Params object because it's safer if the user
        // happens to specify two values for the same key in the query
        const initData: InitDataParams = {};
        if (query.has('pageSize')) {
            const pageSize = Number(query.get('pageSize'));
            if (!isNaN(pageSize))
                initData.pageSize = pageSize;
        }
        if (query.has('page')) {
            const page = validateInteger(query.get('page')!!);
            if (page !== null)
                initData.page = page;
        }
        if (query.has('filters')) {
            const filters = InitData.parseFilters(query.get('filters')!!);
            if (filters.length > 0)
                initData.filters = filters;
        }
        if (query.has('sort') && query.get('sort')!!.trim()) {
            const str = query.get('sort')!!.trim();
            const sort: Sort = {
                active: str.startsWith('-') ? str.slice(1) : str,
                direction: str.startsWith('-') ? 'desc' : 'asc'
            };
            initData.sort = sort;
        }

        return new InitData(initData);
    }

    private static parseFilters(json: string): Filter[] {
        let data: any;

        try {
            data = JSON.parse(json);
        } catch (err) {
            return [];
        }

        if (!Array.isArray(data))
            return [];
        
        const filters: Filter[] = [];
        for (const entry of data) {
            const properties = Object.keys(entry).sort();

            // Test for missing or extra properties
            if (!isEqual(properties, ['param', 'op', 'value'].sort())) {
                continue;
            }

            let notStringFound = false;
            for (const prop of properties) {
                if (typeof entry[prop] !== 'string') {
                    notStringFound = true;
                    break;
                }
            }

            if (notStringFound)
                continue;

            filters.push(entry);
        }

        return filters;
    }
}
