import { HttpRequest } from '@angular/common/http';
import {
    HttpClientTestingModule,
    HttpTestingController
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect } from 'chai';
import * as _ from 'lodash';
import { AuthService } from '../auth/auth.service';
import { MockStorageService } from '../auth/auth.service.spec';
import { StorageService } from '../storage/storage.service';
import { ApiService } from './api.service';
import { ContentRequest } from './content-request';

// NB: The purpose of these tests aren't to verify that the API returns the
// right data, rather that the service makes the calls to the correct URL and
// with the correct HTTP method, body, query, etc.

describe('ApiService', () => {
    let service: ApiService;
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
                ApiService,
                AuthService,
                { provide: StorageService, useClass: MockStorageService }
            ]
        });

        service = TestBed.get(ApiService);
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
            service.content({ schema: schemaName, table: tableName }).subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/data`);
        });

        it('should include filters when requested', () => {
            const req: ContentRequest = {
                 schema: schemaName,
                table: tableName,
                page: 2,
                limit: 50,
                sort: '-foo'
            };
            service.content(req).subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/data`, {
                page: 2,
                limit: 50,
                sort: '-foo'
            });
        });
    });

    describe('pluck', () => {
        it('should request GET /api/v1/schemas/:schema/:table/pluck', () => {
            const selectors = { k1: 'v1', k2: 'v2' };
            service.pluck(schemaName, tableName, selectors).subscribe(verifyExpirationUpdate);

            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/pluck`, selectors);
        });
    });

    describe('columnValues', () => {
        it('should request GET /api/v1/schemas/:schema/:table/column/:col', () => {
            service.columnValues(schemaName, tableName, 'col').subscribe(verifyExpirationUpdate);
            expectGet(`/api/v1/schemas/${schemaName}/${tableName}/column/col`);
        });
    });

    describe('submitRow', () => {
        it('should request POST /api/v1/schemas/:schema/data', () => {
            const body = { some_table: [{ foo: 'bar', baz: 4, qux: false }] };
            service.submitRow(schemaName, body).subscribe(verifyExpirationUpdate);
            http.expectOne((r: HttpRequest<any>): boolean => {
                if (r.method !== 'POST') return false;
                return _.isEqual(r.body, body);

            });
        });
    });

    afterEach(() => {
        http.verify();
    });
});
