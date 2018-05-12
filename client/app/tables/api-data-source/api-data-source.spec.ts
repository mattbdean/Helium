import { CollectionViewer } from '@angular/cdk/collections';
import { fakeAsync, tick } from '@angular/core/testing';
import * as chai from 'chai';
import { clone } from 'lodash';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { SqlRow, TableHeader, TableMeta } from '../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../common/constants';
import { PaginatedResponse } from '../../common/responses';
import { TableService } from '../../core/table/table.service';
import { ApiDataSource } from './api-data-source';

chai.use(sinonChai);
const expect = chai.expect;

describe('ApiDataSource', () => {
    const SCHEMA_NAME = '(schema)';
    const TABLE_NAME = '(table)';
    const emptyTableMeta: TableMeta = {
        schema: SCHEMA_NAME,
        name: TABLE_NAME,
        headers: [{
            name: 'pk',
            type: 'integer',
        } as TableHeader],
        totalRows: 0,
        constraints: [{
            localColumn: 'pk',
            ref: null,
            type: 'primary'
        }],
        comment: '',
        parts: []
    };

    const emptyResponse = () => Observable.of({
        data: [],
        totalRows: 0,
        size: 0
    });

    const createOtherComponents = () => ({
        paginator: {
            length: 0,
            page: Observable.of({ pageIndex: 3, pageSize: 100, length: 1000 })
        } as any,
        sort: Observable.of({ active: 'pk', direction: 'desc' }) as any,
        filters: {
            changed: Observable.of([{ op: 'eq', param: 'pk', value: '55'}])
        } as any
    });

    let source: ApiDataSource;
    let api: TableService;
    let collectionViewer: CollectionViewer;
    let contentStub: sinon.SinonStub;

    beforeEach(() => {
        api = {
            content: (_): Observable<PaginatedResponse<SqlRow[]>> =>
                Observable.never()
        } as TableService;
        contentStub = sinon.stub(api, 'content');
        // By default, calls to api.content() will return no data
        contentStub.returns(emptyResponse());

        source = new ApiDataSource(api);

        collectionViewer = {
            // Believe it or not, this is actually what the Angular datatable
            // provides right now. Either way ApiDataSource doesn't use it
            viewChange: Observable.of({ start: 0, end: Number.MAX_VALUE })
        };

        source.switchTables(emptyTableMeta);
    });

    describe('connect', () => {
        it('should request just the basic data when init has not been called', fakeAsync(() => {
            source.connect(collectionViewer).subscribe();
            tick();
            expect(contentStub).to.have.been.calledWithExactly({
                schema: SCHEMA_NAME,
                table: TABLE_NAME,
                page: 1,
                limit: 25,
                filters: [],
                sort: null
            });
        }));

        it('should support hooking up a MatPaginator, MatSort, and FilterManagerComponent', fakeAsync(() => {

            // Init before we connect
            source.init(createOtherComponents());
            contentStub.returns(emptyResponse());
            source.connect(collectionViewer).subscribe();
            tick();

            expect(contentStub).to.have.been.calledWithExactly({
                schema: SCHEMA_NAME,
                table: TABLE_NAME,
                page: 4,
                limit: 100,
                filters: [{ op: 'eq', param: 'pk', value: '55' }],
                sort: '-pk'
            });
        }));

        it('should format date, datetime, and boolean headers', fakeAsync(() => {
            const meta = clone(emptyTableMeta);
            meta.headers = [
                { name: 'date', type: 'date' } as TableHeader,
                { name: 'datetime', type: 'datetime' } as TableHeader,
                { name: 'boolean', type: 'boolean' } as TableHeader
            ];

            const now = moment();

            const res: PaginatedResponse<SqlRow[]> = {
                totalRows: 1,
                size: 1,
                data: [{
                    date: now.format(DATE_FORMAT),
                    datetime: now.format(DATETIME_FORMAT),
                    boolean: 1
                }]
            };
            contentStub.returns(Observable.of(res));

            let asserted = false;

            source.switchTables(meta);
            tick();
            source.connect(collectionViewer).subscribe((data) => {
                expect(data).to.have.lengthOf(1);
                expect(data[0]).to.deep.equal({
                    __insertLike: true,
                    date: now.format('l'),
                    datetime: now.format('LLL'),
                    boolean: true
                });
                asserted = true;
            });

            if (!asserted) {
                throw new Error('No data came from observable');
            }
        }));

        it('should update the paginator length after every content response', fakeAsync(() => {
            const { paginator, sort, filters } = createOtherComponents();
            source.init({ paginator, sort, filters });
            contentStub.returns(Observable.of({
                data: [{ pk: '0' }],
                totalRows: 100,
                size: 0
            }));
            source.connect(collectionViewer).subscribe();
            tick();

            expect(paginator.length).to.equal(100);
        }));
    });
});
