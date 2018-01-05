import {
    HttpClient, HttpHeaders, HttpParams,
    HttpResponse
} from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs/Observable';

import * as _ from 'lodash';

import { Filter, SqlRow, TableMeta } from '../common/api';
import { PaginatedResponse } from '../common/responses';
import { TableNameParams } from '../common/table-name-params.interface';
import { TableName } from '../common/table-name.class';
import { AuthService } from './auth.service';

const encode = encodeURIComponent;

/**
 * This class provides a clean way to interact with the JSON API using Angular's
 * HttpClient service.
 *
 * Upon each response, the session expiration is updated according to the value
 * of the custom X-Session-Expiration header sent with API responses.
 */
@Injectable()
export class TableService {
    constructor(private http: HttpClient, private auth: AuthService) {}

    public schemas(): Observable<string[]> {
        return this.get('/schemas');
    }

    /** Fetches a list of all tables in the given schema */
    public tables(schema: string): Observable<TableName[]> {
        return this.get<TableNameParams[]>(`/schemas/${schema}`)
            .map((params) => params.map((p) => new TableName(schema, p)));
    }

    /** Fetches meta for a given table */
    public meta(schema: string, table: string): Observable<TableMeta> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}`);
    }

    /** Fetches paginated data from a given table */
    public content(schema: string,
                   table: string,
                   page: number = 1,
                   limit: number = 25,
                   sort?: string,
                   filters: Filter[] = []): Observable<SqlRow[]> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}/data`, {
            page, limit, sort, filters: JSON.stringify(filters)
        }).map((data: PaginatedResponse<SqlRow[]>) => data.data);
    }

    public columnValues(schema: string, table: string, column: string): Observable<any[]> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}/column/${encode(column)}`);
    }

    /**
     * Attempts to add a row to the database for a given table. The table must
     * exist and the body must have the shape of a SqlRow.
     */
    public submitRow(schema: string, tableName: string, body: SqlRow): Observable<null> {
        return this.http.put(
            `/api/v1/schemas/${encode(schema)}/data`,
            body,
            {
                headers: new HttpHeaders({
                    // Make sure the API knows we're sending JSON
                    'Content-Type': 'application/json',
                    'X-API-Key': this.auth.requireApiKey()
                }),
                observe: 'response'
            }
        )
            .do((res) => this.updateSession(res))
            .mapTo(null);
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
        const headers = { 'X-API-Key': this.auth.requireApiKey() };
        return this.http.get(`/api/v1${relPath}`, { params, headers, observe: 'response' })
            .do((res) => this.updateSession(res))
            .map((res) => res.body as T);
    }

    private updateSession<T>(res: HttpResponse<T>): T {
        const newExpiration = res.headers.get('X-Session-Expiration');
        // This header is the unix time at which the session expires
        if (newExpiration !== null) {
            const time = parseInt(newExpiration, 10);
            this.auth.updateExpiration(time);
        }

        return res.body as T;
    }
}
