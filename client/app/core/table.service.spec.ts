import { inject, TestBed } from '@angular/core/testing';
import { HttpModule, RequestMethod, XHRBackend } from '@angular/http';
import { MockBackend, MockConnection } from '@angular/http/testing';
import { TableService } from './table.service';

import { expect } from 'chai';

describe('TableService', () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpModule
            ],
            providers: [
                TableService,
                { provide: XHRBackend, useClass: MockBackend }
            ]
        });
    });

    describe('list', () => {
        it('should request GET /api/v1/tables',
            inject([TableService, XHRBackend], (service: TableService, mockBackend: MockBackend) => {

            mockBackend.connections.subscribe((connection: MockConnection) => {
                expect(connection.request.method).to.equal(RequestMethod.Get);
                expect(connection.request.url).to.equal('/api/v1/tables');
            });
            service.list().subscribe();
        }));
    });

    describe('meta', () => {
        it('should request GET /api/v1/tables/:table',
            inject([TableService, XHRBackend], (service: TableService, mockBackend: MockBackend) => {

            const name = 'foobar';
            mockBackend.connections.subscribe((connection: MockConnection) => {
                expect(connection.request.method).to.equal(RequestMethod.Get);
                expect(connection.request.url).to.equal(`/api/v1/tables/${name}`);
            });

            service.meta(name).subscribe();
        }));
    });
});
