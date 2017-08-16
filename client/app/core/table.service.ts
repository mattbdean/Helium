import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from "rxjs/Observable";

import * as _ from 'lodash';

import { SqlRow, TableMeta, TableName } from '../common/api';
import { PaginatedResponse } from '../common/responses';

/**
 * This class provides a clean way to interact with the JSON API using Angular's
 * Http service.
 */
@Injectable()
export class TableService {
    constructor(private http: HttpClient) {}

    /** Fetches a list of all tables */
    public list(): Observable<TableName[]> {
        return this.get(`/tables`);
    }

    /** Fetches meta for a given table */
    public meta(name: string): Observable<TableMeta> {
        return this.get(`/tables/${encodeURIComponent(name)}`);
    }

    /** Fetches paginated data from a given table */
    public content(name: string, page: number = 1, limit: number = 25, sort?: string): Observable<SqlRow[]> {
        return this.get(`/tables/${encodeURIComponent(name)}/data`, {
            page, limit, sort
        }).map((data: PaginatedResponse<SqlRow[]>) => data.data);
    }

    public columnValues(table: string, column: string): Observable<any[]> {
        return this.get(`/tables/${encodeURIComponent(table)}/column/${encodeURIComponent(column)}`);
    }

    /**
     * Attempts to add a row to the database for a given table. The table must
     * exist and the body must have the shape of a SqlRow.
     */
    public submitRow(tableName: string, body: SqlRow): Observable<void> {
        return this.http.put(
            `/api/v1/tables/${encodeURIComponent(tableName)}/data`,
            body,
            {
                headers: new HttpHeaders({
                    // Make sure the API knows we're sending JSON
                    'Content-Type': 'application/json'
                })
            }
        ).mapTo(null);
    }

    /**
     * Convenience method to make a GET request to a path relative of `/api/v1`
     * and cast its JSON response as the type T
     */
    private get<T>(relPath: string, query: any = {}): Observable<T> {
        // Only include non-null and non-undefined values in the query
        const used = _.omitBy(query, _.isNil);

        let params = new HttpParams();
        for (const key of Object.keys(used)) {
            params = params.set(key, used[key]);
        }
        return this.http.get(`/api/v1${relPath}`, { params })
            .map((res) => res as T);
    }
}
