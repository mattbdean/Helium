import { DebugElement } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';

import { TableService } from '../../core/table/table.service';
import { DatatableComponent } from './datatable.component';

const expect = global['chai'].expect;

describe('DatatableComponent', () => {
    let fixture: ComponentFixture<DatatableComponent>;
    let comp: DatatableComponent;
    let de: DebugElement;
    let service: TableService;

    // const tableServiceStub = {
    //     meta: (name: string): Observable<TableMeta> =>
    //         Observable.throw(new Error('not stubbed')),
    //     content: (name: string): Observable<SqlRow> =>
    //         Observable.throw(new Error('not stubbed')),
    // };
    //
    // const mockTableMeta = (): TableMeta => ({
    //     schema: 'schema',
    //     name: 'foo',
    //     headers: [],
    //     totalRows: 0,
    //     constraints: [],
    //     comment: 'description',
    //     parts: []
    // });
    //
    // beforeEach(() => {
    //     TestBed.configureTestingModule({
    //         imports: [
    //             CoreModule,
    //             MatIconModule,
    //             MatProgressBarModule,
    //             MatSnackBarModule,
    //             NgxDatatableModule,
    //             RouterTestingModule
    //         ],
    //         declarations: [
    //             DatatableComponent
    //         ],
    //         providers: [
    //             { provide: TableService, useValue: tableServiceStub }
    //         ],
    //         schemas: [
    //             // Ignore unknown children (aka filter-manager)
    //             NO_ERRORS_SCHEMA
    //         ]
    //     });
    //
    //     fixture = TestBed.createComponent(DatatableComponent);
    //     comp = fixture.componentInstance;
    //     de = fixture.debugElement;
    //     service = de.injector.get(TableService);
    // });
    //
    // it('should pull in the metadata when given a name', () => {
    //     expect(comp.meta).to.be.null;
    //     comp.name = new TableName('schema', 'foo');
    //
    //     const stub = sinon.stub(service, 'meta')
    //         .returns(Observable.of<TableMeta>(mockTableMeta()));
    //
    //     fixture.detectChanges();
    //     expect(stub).to.have.been.calledOnce;
    //
    //     // Header
    //     expect(de.query(By.css('h1')).nativeElement.textContent.trim()).to.equal('Foo');
    //
    //     // Description right under the header
    //     expect(de.query(By.css('.table-description')).nativeElement.textContent).to.match(/description/);
    // });

    it('should show a message when the table can\'t be found');
    it('should render blob and null values specially');
    it('should include a header for every element of data');
    it('should include constraint icons in the column header');
    it('should update the title to the name of the current table');
    it('should render an extra column for the "insert like" row at the beginning');
    it('should show a message when there is no data in the table');
    it('should show a progress bar when switching to a new table');
    it.skip('should allow selections when [selectionMode] is "one"');
});
