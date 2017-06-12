
import { Injectable } from '@angular/core';
import { Http } from '@angular/http';

import * as _ from 'lodash';

import { PaginatedResponse, SqlRow, TableHeader } from '../common/responses';

/**
 * This class provides a clean way to interact with the JSON API using Angular's
 * Http service.
 */
@Injectable()
export class TableService {
    constructor(private http: Http) {}

    /** Fetches a list of all tables */
    public list(): Promise<string[]> {
        return this.get(`/tables`);
    }

    /** Fetches headers for a given table */
    public headers(name: string): Promise<TableHeader[]> {
        return this.get(`/tables/${encodeURIComponent(name)}/meta`);
    }

    /** Fetches paginated data from a given table */
    public content(name: string, page: number = 1, limit: number = 25): Promise<SqlRow[]> {
        return this.get(`/tables/${encodeURIComponent(name)}`, {
            page, limit
        }).then((data: PaginatedResponse<SqlRow[]>) => data.data);
    }

    /**
     * Convenience method to make a GET request to a path relative of `/api/v1`
     * and cast its JSON response as the type T
     */
    private async get<T>(relPath: string, query: any = {}): Promise<T> {
        return (await this.http.get(`/api/v1${relPath}${this.createQuery(query)}`)
            .toPromise()).json() as T;
    }

    /**
     * Creates a query string from the properties of an object. Only uses
     * properties with defined values. URL-encodes all keys and values.
     *
     * ```
     * createQuery({ foo: "bar", baz: "qux" }) ==> "?foo=bar&baz=qux"
     * ```
     */
    private createQuery(from: any): string {
        const props = _.filter(Object.keys(from), (key) => from[key] !== undefined);
        if (props.length === 0) return "";

        let query = "?";

        for (let i = 0; i < props.length; i++) {
            query += `${encodeURIComponent(props[i])}=${encodeURIComponent(from[props[i]])}`;
            if (i !== props.length - 1)
                query += "&";
        }

        return query;
    }
}
