import { HttpRequest } from '@angular/common/http';
import {
    HttpClientTestingModule,
    HttpTestingController
} from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import * as _ from 'lodash';

import { TableService } from './table.service';

// NB: The purpose of these tests aren't to verify that the API returns the
// right data, rather that the service makes the calls to the correct URL and
// with the correct HTTP method, body, query, etc.

describe('TableService', () => {
    let service: TableService;
    let http: HttpTestingController;
    const tableName = 'foobar';

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule
            ],
            providers: [
                TableService
            ]
        });

        service = TestBed.get(TableService);
        http = TestBed.get(HttpTestingController);
    });

    /**
     * Makes an expectation that a GET request will be made at the given URL.
     * If a query is provided as the second argument, every key-value pair in
     * that object must be present in the request's query.
     */
    const expectGet = (url: string, query?: { [key: string]: string | number }) => {
        http.expectOne((r: HttpRequest<any>): boolean => {
            if (r.method !== 'GET') return false;
            if (query === undefined) {
                if (r.urlWithParams !== url) return false;
            } else {
                if (r.url !== url) return false;
                for (const key of Object.keys(query)) {
                    if (!r.params.has(key)) return false;
                    if (r.params.get(key) !== query[key]) return false;
                }
            }

            return true;
        });
    };

    describe('list', () => {
        it('should request GET /api/v1/tables', () => {
            service.list().subscribe();
            expectGet('/api/v1/tables');
        });

        it('should cache the request values', fakeAsync(() => {
            service.list().subscribe();
            tick();
            service.list().subscribe();
            expectGet('/api/v1/tables');
        }));
    });

    describe('meta', () => {
        it('should request GET /api/v1/tables/:table', () => {
            service.meta(tableName).subscribe();
            expectGet(`/api/v1/tables/${tableName}`);
        });
    });

    describe('content', () => {
        it('should request GET /api/v1/tables/:table/data', () => {
            service.content(tableName).subscribe();
            expectGet(`/api/v1/tables/${tableName}/data`, {
                page: 1,
                limit: 25
            });
        });

        it('should include filters when requested', () => {
            // Include pageNumber, limit, and sort, respectively
            service.content(tableName, 2, 50, '-foo').subscribe();
            expectGet(`/api/v1/tables/${tableName}/data`, {
                page: 2,
                limit: 50,
                sort: '-foo'
            });
        });
    });

    describe('columnValues', () => {
        it('should request GET /api/v1/tables/', () => {
            service.columnValues(tableName, 'col').subscribe();
            expectGet(`/api/v1/tables/${tableName}/column/col`);
        });
    });

    describe('submitRow', () => {
        it('should request PUT /api/v1/tables/:table/data', () => {
            const body = { foo: 'bar', baz: 4, qux: false };
            service.submitRow(tableName, body).subscribe();
            http.expectOne((r: HttpRequest<any>): boolean => {
                if (r.method !== 'PUT') return false;
                return _.isEqual(r.body, body);

            });
        });
    });

    afterEach(() => {
        http.verify();
    });
});
