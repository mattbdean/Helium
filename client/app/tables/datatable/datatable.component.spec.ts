import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    MatPaginatorModule, MatSnackBarModule, MatSortModule,
    MatTableModule
} from '@angular/material';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';

import * as chai from 'chai';
import { clone } from 'lodash';
import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

import { HttpErrorResponse } from '@angular/common/http';
import { Constraint, SqlRow, TableDataType, TableMeta } from '../../common/api';
import { PaginatedResponse } from '../../common/responses';
import { TableName } from '../../common/table-name.class';
import { CoreModule } from '../../core/core.module';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { DatatableComponent } from './datatable.component';

chai.use(sinonChai);
const expect = chai.expect;

describe('DatatableComponent', () => {
    const SCHEMA = '(schema)';
    const DEFAULT_TABLE_NAME = 'foo';

    let fixture: ComponentFixture<DatatableComponent>;
    let comp: DatatableComponent;
    let de: DebugElement;
    let service: TableService;
    let router: Router;

    let metaStub: sinon.SinonStub;
    let contentStub: sinon.SinonStub;

    const tableServiceStub = {
        meta: (_: string): Observable<TableMeta> =>
            Observable.throw(new Error('not stubbed')),
        content: (_): Observable<PaginatedResponse<SqlRow[]>> =>
            Observable.throw(new Error('not stubbed'))
    };

    const routerStub = {
        // Do nothing by default
        navigate: () => undefined
    };

    const mockTableMeta = (name: string,
                           headerTypes: TableDataType[],
                           primaryKeys: TableDataType[] = []): TableMeta => ({

        schema: 'schema',
        name,
        headers: headerTypes.map((t) => ({ name: t, type: t } as any)),
        totalRows: 0,
        constraints: [
            ...primaryKeys.map((t): Constraint => ({ localColumn: t, type: 'primary', ref: null }))
        ],
        comment: 'description',
        parts: []
    });

    const paginatedResponse = (data: SqlRow[]): Observable<PaginatedResponse<SqlRow[]>> =>
        Observable.of({ size: data.length, data: clone(data), totalRows: 1000 });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                CoreModule,
                MatPaginatorModule,
                MatSnackBarModule,
                MatSortModule,
                MatTableModule,
                NoopAnimationsModule
            ],
            declarations: [
                DatatableComponent
            ],
            providers: [
                ApiDataSource,
                { provide: TableService, useValue: tableServiceStub },
                { provide: Router, useValue: routerStub }
            ],
            schemas: [
                // Ignore irrelevant children
                NO_ERRORS_SCHEMA
            ]
        });

        fixture = TestBed.createComponent(DatatableComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        service = de.injector.get(TableService);
        router = de.injector.get(Router);

        comp.name = new TableName(SCHEMA, DEFAULT_TABLE_NAME);
        metaStub = sinon.stub(service, 'meta')
            .returns(Observable.of(mockTableMeta(DEFAULT_TABLE_NAME, ['integer'], ['integer'])));
        contentStub = sinon.stub(service, 'content')
            .returns(paginatedResponse([]));
    });

    it('should show a message when the table can\'t be found', () => {
        metaStub.returns(Observable.throw(new HttpErrorResponse({
            status: 404,
            statusText: 'Not Found'
        })));

        fixture.detectChanges();

        expect(de.query(By.css('.table-not-found'))).to.exist;
        expect(de.query(By.css('mat-table'))).to.not.exist;
    });

    it('should render blob and null values specially');
    it('should include a header for every element of data');
    it('should include constraint icons in the column header');
    it('should update the title to the name of the current table');
    it('should show a message when there is no data in the table');
    it('should show a progress bar when switching to a new table');
    it('should try to sort when a header is clicked');

    it('should render an extra column for the "insert like" row at the beginning', () => {
        // Give the table some data
        contentStub.returns(paginatedResponse([{ integer: 4 }]));

        const routerSpy = sinon.spy(router, 'navigate');

        fixture.detectChanges();

        const headers = de.queryAll(By.css('mat-header-cell'));
        // By default only one column is created, so that one column plus the
        // "insert like" column should make two.
        expect(headers.length).to.equal(2);

        de.queryAll(By.css('.insert-like-icon'))[0].nativeElement.click();

        expect(routerSpy).to.have.been.calledOnce;
        const route = ['/forms', SCHEMA, DEFAULT_TABLE_NAME];
        // The only row we gave the table is this one:
        const query = { queryParams: { row: JSON.stringify({ integer: 4 }) }};
        expect(routerSpy).to.have.been.calledWithExactly(route, query);
    });
    it.skip('should allow selections when [selectionMode] is "one"');
});
