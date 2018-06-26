import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { CompoundConstraint, PaginatedResponse, SqlRow, TableHeader, TableInsert, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { ContentRequest } from './content-request';
import { TableService } from './table.service';

@Injectable()
export class MockTableService extends TableService {
    public schemas(): Observable<string[] | null> {
        return this.delay(['schema1', 'schema2']);
    }

    public tables(schema: string): Observable<TableName[]> {
        return this.delay([new TableName(schema, 'foo')]);
    }

    public meta(schema: string, table: string): Observable<TableMeta> {
        const header: TableHeader = {
            name: 'foo',
            type: 'integer',
            rawType: 'int(11)',
            isNumerical: true,
            isTextual: false,
            ordinalPosition: 1,
            signed: true,
            nullable: false,
            maxCharacters: null,
            charset: null,
            numericPrecision: 10,
            numericScale: 0,
            enumValues: null,
            comment: 'a row',
            tableName: table,
            defaultValue: null
        };
        const constraint: CompoundConstraint = {
            name: 'PRIMARY',
            type: 'primary',
            constraints: [{
                localColumn: 'foo',
                type: 'primary',
                ref: null
            }]
        };
        return this.delay({
            schema,
            name: table,
            headers: [header],
            totalRows: 0,
            constraints: [
                constraint
            ],
            comment: 'a table',
            parts: []
        });
    }

    public content(req: ContentRequest): Observable<PaginatedResponse<SqlRow[]>> {
        return this.delay({
            size: 0,
            data: [],
            totalRows: 0
        });
    }

    public pluck(schema: string, table: string, selectors: { [key: string]: string }): Observable<TableInsert> {
        return this.delay({ [table]: [] });
    }

    public columnValues(schema: string, table: string, column: string): Observable<any[]> {
        return this.delay([]);
    }

    public submitRow(schema: string, body: SqlRow): Observable<null> {
        return this.delay(null);
    }

    private delay<T>(data: T): Observable<T> {
        // Delay 10-20 ms
        return of(data).pipe(delay(10 + (Math.random() * 10)));
    }
}
