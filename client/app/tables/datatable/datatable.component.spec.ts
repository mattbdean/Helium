import { HttpErrorResponse } from '@angular/common/http';
import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
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
import { CompoundConstraint, Constraint, PaginatedResponse, SqlRow, TableDataType, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { CoreModule } from '../../core/core.module';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from '../api-data-source/api-data-source';
import { LayoutHelper } from '../layout-helper/layout-helper';
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

    const layoutHelperStub = {
        recalculate: () => [],
        init: () => undefined
    };

    const mockTableMeta = (name: string,
                           headerTypes: TableDataType[],
                           primaryKeys: TableDataType[] = []): TableMeta => {
        const constraints: Constraint[] = primaryKeys.map((t): Constraint =>
            ({ localColumn: t, type: 'primary', ref: null }));

        const compoundConstraint: CompoundConstraint = {
            name: 'PRIMARY',
            type: 'primary',
            constraints
        };

        return {
            schema: 'schema',
            name,
            headers: headerTypes.map((t) => ({ name: t, type: t } as any)),
            totalRows: 0,
            constraints: [compoundConstraint],
            comment: 'description',
            parts: []
        };
    };

    const paginatedResponse = (data: SqlRow[]): Observable<PaginatedResponse<SqlRow>> =>
        // delay(0) is required here to delay change detection until the next
        // cycle
        Observable.of({ size: data.length, data: clone(data), totalRows: 1000 }).delay(0);

    const updateAllData = () => {
        // Detect the changes and pull in mockTableMeta (synchronous) and start
        // paginatedResponse (async)
        fixture.detectChanges();
        // Wait for paginatedResponse to finish (aka wait until next event loop)
        tick();
        // Detect changes again to display the data
        fixture.detectChanges();
    };

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
                { provide: Router, useValue: routerStub },
                { provide: LayoutHelper, useValue: layoutHelperStub },
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

    it('should render blob and null values specially', fakeAsync(() => {
        // Set up the table and its data
        metaStub.returns(Observable.of(mockTableMeta(DEFAULT_TABLE_NAME, ['integer', 'blob'])));
        contentStub.returns(paginatedResponse([
            // The real API would return '<blob>' for all blob values
            { integer: null, blob: 'foo' },
            { integer: 4,    blob: 'bar' }
        ]));

        updateAllData();

        const [firstRow, secondRow] = de.queryAll(By.css('mat-row'))
            .map((row) => row.queryAll(By.css('mat-cell')));

        // All null values and all blob columns should be rendered specially.
        // Start at index 1 since index 0 for all rows will be the "insert like"
        // cell
        const specialCells = [firstRow[1], firstRow[2], secondRow[2]];
        for (const specialCell of specialCells) {
            expect(specialCell.query(By.css('span.special-cell'))).to.exist;
        } 

        // Otherwise the cells should be rendered normally
        const normalCells = [secondRow[1]];
        for (const normalCell of normalCells) {
            expect(normalCell.query(By.css('span.special-cell'))).to.not.exist;
        }

        // Make sure we're rendering a string representation of the null value
        expect(firstRow[1].nativeElement.textContent.trim()).to.equal('null');
    }));

    it('should include a header for every element of data', () => {
        const colNames: TableDataType[] = ['integer', 'float', 'boolean'];
        metaStub.returns(Observable.of(mockTableMeta(DEFAULT_TABLE_NAME, colNames)));
        fixture.detectChanges();

        const renderedNames = de.queryAll(By.css('mat-header-cell'))
            .map((header) => header.nativeElement.textContent.trim())
            // Remove header 0, which is the "insert like" header
            .slice(1);

        expect(renderedNames).to.deep.equal(colNames);
    });

    it('should include constraint icons in the column header', () => {
        const colNames: TableDataType[] = ['integer', 'float', 'boolean'];
        const primaryKeys = colNames.slice(0, 1);
        metaStub.returns(Observable.of(mockTableMeta(DEFAULT_TABLE_NAME, colNames, primaryKeys)));
        fixture.detectChanges();

        // Even though there are no icons necessary for some of these columns,
        // there should still be a <constraint-icons> in the header
        expect(de.queryAll(By.css('constraint-icons'))).to.have.lengthOf(colNames.length);
    });

    it('should update the title to the name of the current table', () => {
        fixture.detectChanges();
        const expectedTableName = new TableName('(unused)', DEFAULT_TABLE_NAME).name.clean;
        expect(de.queryAll(By.css('h1'))[0].nativeElement.textContent.trim()).to.equal(expectedTableName);
    });

    // TODO currently fails because ng-inline-svg attempts to make an XHR request
    it.skip('should show a message when there is no data in the table', fakeAsync(() => {
        // There's no data so we should expect to see the message here
        fixture.detectChanges();
        expect(de.query(By.css('.no-data-message'))).to.exist;

        // Switch to a new table that has data, should not see the message
        // anymore.
        const newName = new TableName('(unused)', 'tableName');
        metaStub.returns(Observable.of(mockTableMeta(newName.name.raw, ['float'])));
        contentStub.returns(paginatedResponse([{ float: 1 }]));
        comp.name = newName;

        updateAllData();
        expect(de.query(By.css('.no-data-message'))).to.not.exist;
    }));

    it('should show a progress bar when switching to a new table', () => {
        contentStub.returns(Observable.never());
        fixture.detectChanges();

        expect(de.query(By.css('mat-progress-bar')).nativeElement.attributes.hidden)
            .to.not.be.undefined;
    });

    // TODO currently fails because ng-inline-svg attempts to make an XHR request
    it.skip('should render an extra column for the "insert like" row at the beginning', fakeAsync(() => {
        // Give the table some data
        contentStub.returns(paginatedResponse([{ integer: 4 }]));

        const routerSpy = sinon.spy(router, 'navigate');

        updateAllData();

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
    }));

    it.skip('should allow selections when [selectionMode] is "one"');
});
