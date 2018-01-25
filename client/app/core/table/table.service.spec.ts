import { HttpRequest } from '@angular/common/http';
import {
    HttpClientTestingModule,
    HttpTestingController
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import * as _ from 'lodash';

import { AuthService } from '../auth/auth.service';
import { MockStorageService } from '../auth/auth.service.spec';
import { StorageService } from '../storage/storage.service';
import { TableService } from './table.service';

import { expect } from 'chai';

// NB: The purpose of these tests aren't to verify that the API returns the
// right data, rather that the service makes the calls to the correct URL and
// with the correct HTTP method, body, query, etc.

describe('TableService', () => {
    let service: TableService;
    let http: HttpTestingController;
    let auth: AuthService;
    const schemaName = 'baz';
    const tableName = 'foobar';

    // 10 sec in the future
    const prevExpiration = Date.now() + 10000;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule
            ],
            providers: [
                TableService,
                AuthService,
                { provide: StorageService, useClass: MockStorageService }
            ]
        });

        service = TestBed.get(TableService);
        http = TestBed.get(HttpTestingController);
        auth = TestBed.get(AuthService);

        // Set the initial API key and expiration
        auth.update({ apiKey: 'foo', expiration: new Date(prevExpiration) });
    });

    /**
     * Makes an expectation that a GET request will be made at the given URL.
     * If a query is provided as the second argument, every key-value pair in
     * that object must be present in the request's query.
     */
    const expectGet = (url: string, query?: { [key: string]: string | number }) => {
        const res = http.expectOne((r: HttpRequest<any>): boolean => {
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

        res.flush([ /* empty array as body, tables() requires an array */], {
            headers: {
                // Expires 1 min in the future
                'X-Session-Expiration': String(Date.now() + 60000)
            }
        });
    };

    const verifyExpirationUpdate = () => {
        expect(auth.expiration!!.getTime()).to.be.above(prevExpiration);
    };

    describe('schemas', () => {
        it('should request GET /api/v1/schemas', () => {
            service.schemas().subscribe(verifyExpirationUpdate);
            expectGet('/api/v1/schemas');
        });
    });

    describe('tables', () => {
        it('should request GET /api/v1/schemas/:schema', () => {
            service.tables(schemaName).subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}`);
        });
    });

    describe('meta', () => {
        it('should request GET /api/v1/schemas/:schema/:table', () => {
            service.meta(schemaName, tableName).subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}`);
        });
    });

    describe('content', () => {
        it('should request GET /api/v1/schemas/:schema/:table/data', () => {
            service.content(schemaName, tableName).subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/data`, {
                page: 1,
                limit: 25
            });
        });

        it('should include filters when requested', () => {
            // Include pageNumber, limit, and sort, respectively
            service.content(schemaName, tableName, 2, 50, '-foo').subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/data`, {
                page: 2,
                limit: 50,
                sort: '-foo'
            });
        });
    });

    describe('columnValues', () => {
        it('should request GET /api/v1/schemas/:schema/:table/column/:col', () => {
            service.columnValues(schemaName, tableName, 'col').subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/column/col`);
        });
    });

    describe('submitRow', () => {
        it('should request PUT /api/v1/schemas/:schema/:table/data', () => {
            const body = { foo: 'bar', baz: 4, qux: false };
            service.submitRow(schemaName, tableName, body).subscribe(verifyExpirationUpdate);
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
