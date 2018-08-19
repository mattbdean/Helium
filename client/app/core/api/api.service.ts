import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import { map, mapTo, shareReplay, tap } from 'rxjs/operators';
import { Erd, PaginatedResponse, SqlRow, TableInsert, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { TableNameParams } from '../../common/table-name-params';
import { AuthService } from '../auth/auth.service';
import { BaseApiService } from './base-api-service';
import { ContentRequest } from './content-request';

const encode = encodeURIComponent;

/**
 * This class provides a clean way to interact with the JSON API using Angular's
 * HttpClient service.
 *
 * Upon each response, the session expiration is updated according to the value
 * of the custom X-Session-Expiration header sent with API responses.
 */
@Injectable()
export class ApiService implements BaseApiService {
    constructor(private http: HttpClient, private auth: AuthService) {}

    public schemas(): Observable<string[]> {
        return this.get<string[]>('/schemas');
    }

    public tables(schema: string): Observable<TableName[]> {
        return this.get<TableNameParams[]>(`/schemas/${schema}`)
            .pipe(map((params) => params.map((p) => new TableName(schema, p))));
    }

    public meta(schema: string, table: string): Observable<TableMeta> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}`);
    }

    public content(req: ContentRequest): Observable<PaginatedResponse<SqlRow>> {
        const shouldUseFilters = req.filters === undefined || req.filters.length === 0;

        // If a property is null or undefined, it won't be included in the query
        const query = _.pickBy({
            page: req.page,
            limit: req.limit,
            sort: req.sort,
            filters: shouldUseFilters ? undefined : JSON.stringify(req.filters)
        }, (p) => !_.isNil(p));

        return this.get(
            `/schemas/${encode(req.schema)}/${encode(req.table)}/data`,
            query
        );
    }

    public pluck(schema: string, table: string, selectors: { [key: string]: string }): Observable<TableInsert> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}/pluck`, selectors);
    }

    public columnValues(schema: string, table: string, column: string): Observable<any[]> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}/column/${encode(column)}`);
    }

    public submitRow(schema: string, body: TableInsert): Observable<null> {
        return this.http.post(
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
        ).pipe(
            tap((res) => this.updateSession(res)),
            mapTo(null)
        );
    }

    public defaults(schema: string, table: string): Observable<SqlRow> {
        return this.get(`/schemas/${encode(schema)}/${encode(table)}/defaults`);
    }

    /**
     * Requests the ERD for all tables in all schemas the user has access to
     */
    public erd(): Observable<Erd> {
        return this.get('/erd').pipe(
            map((erd: Erd): Erd => {
                return {
                    edges: erd.edges,
                    nodes: erd.nodes.map((n) => {
                        return {
                            id: n.id,
                            // n.table is a TableNameParams, recreate it as
                            // an actual TableName
                            table: new TableName(n.table.schema, n.table.name.raw)
                        };
                    })
                };
            })
        );
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
        return this.http.get(`/api/v1${relPath}`, { params, headers, observe: 'response' }).pipe(
            tap((res) => this.updateSession(res)),
            map((res) => res.body as T)
        );
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
