import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as faker from 'faker';
import * as _ from 'lodash';
import { Observable, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { TableDataType } from '../../../../server/src/common/api';
import {
    CompoundConstraint,
    ErrorResponse,
    PaginatedResponse,
    SqlRow,
    TableHeader,
    TableInsert,
    TableMeta
} from '../../common/api';
import { TableName } from '../../common/table-name';
import { BaseApiService } from './base-api-service';
import { ContentRequest } from './content-request';

/**
 * Emulates the Helium API. Constructor invocation can be costly depending on
 * how much data there needs to be generated. In the future, data should be
 * generated on-demand instead of all at once.
 * 
 * All data is stored in memory. Each function extended from ApiService does
 * its best to mimic the Helium API in terms of data structure.
 */
@Injectable()
export class MockApiService implements BaseApiService {
    private readonly metas: TableMeta[];
    private readonly data: DataDef[];

    public constructor() {
        const ids = TABLES.map((t) => ({ schema: t.schema, name: t.name }));
        const result = TABLES.map((def) => MockApiService.compileTableDef(def, ids));
        this.metas = result.map((r) => r.meta);
        this.data = result.map((r) => r.data);
    }

    public schemas(): Observable<string[]> {
        return this.delay(_(this.metas)
            .map((m) => m.schema)
            .uniq()
            .value());
    }

    public tables(schema: string): Observable<TableName[]> {
        const names: TableName[] = this.metas
            .filter((m) => m.schema === schema)
            .map((m) => new TableName(m.schema, m.name));

        return this.delay(names);
    }

    public meta(schema: string, table: string): Observable<TableMeta> {
        const meta = this.metas.find((m) => m.schema === schema && m.name === table);
        let obs: Observable<TableMeta>;
        if (meta === undefined)
            obs = throwError(this.errorResponse({
                res: {
                    message: 'Not found'
                },
                status: 404
            }));
        else
            obs = of(meta);
        
        return obs.pipe(delay(this.delayTime()));
    }

    public content(req: ContentRequest): Observable<PaginatedResponse<SqlRow>> {
        return this.fetchData(req.schema, req.table).pipe(
            map((data): PaginatedResponse<SqlRow> => {
                const totalRows = data === undefined ? 0 : data.length;
                let applicableData: SqlRow[] = data;
                
                const limit = req.limit ? Math.max(0, Math.min(req.limit!!, 100)) : 25;
                const page = req.page ? req.page : 1;

                if (req.sort) {
                    const sortDir = req.sort.startsWith('-') ? 'desc' : 'asc';
                    const sortProp = req.sort.startsWith('-') ? req.sort.slice(1) : req.sort;
                    applicableData = _.orderBy(applicableData, sortProp, sortDir);
                }

                const start = (page - 1) * limit;
                if (start >= applicableData.length && totalRows !== 0) {
                    throw new Error('Page too high');
                }

                applicableData = applicableData.slice(start, start + limit);

                return {
                    size: applicableData.length,
                    data: applicableData,
                    totalRows
                };
            })
        );
    }

    public pluck(schema: string, table: string, selectors: { [key: string]: string }): Observable<TableInsert> {
        const dataDef = this.data.find((d) => d.schema === schema && d.table === table);
        const rows: SqlRow[] = [];

        if (dataDef !== undefined) {
            const props = Object.keys(selectors);
            const pluckedRow: SqlRow | undefined = _.find(dataDef.data, (row) => {
                // This method will work for simple types like numbers and
                // strings. It's unlikely that dates/datetimes will be used as
                // selectors so we should be fine with this.
                for (const prop of props) {
                    if (String(row[prop]) !== selectors[prop])
                        return false;
                }

                return true;
            }) as any;

            if (pluckedRow !== undefined)
                rows.push(pluckedRow);
        }

        return this.delay({
            [table]: rows
        });
    }

    public columnValues(schema: string, table: string, column: string): Observable<any[]> {
        return this.fetchData(schema, table).pipe(
            // Assume the column exists for now
            map((data) => data.map((row) => row[column]))
        );
    }

    public submitRow(schema: string, body: TableInsert): Observable<null> {
        // Assume the master/only table is specified first
        return this.delay(null).pipe(
            tap(() => {
                for (const table of Object.keys(body)) {
                    const dataDef = this.data.find((d) => d.schema === schema && d.table === table);
                    if (dataDef === undefined)
                        throw this.errorResponse({
                            res: { message: `Table not found: ${schema}.${table}` },
                            status: 400
                        });
                    
                    dataDef.data.push(...body[table]);
                }
            })
        );
    }

    /**
     * Returns an Observable that emits only the given data after a variable
     * amount of time. That time is calculated by `this.delayTime()`.
     */
    private delay<T>(data: T): Observable<T> {
        return of(data).pipe(delay(this.delayTime()));
    }

    /**
     * Generates a random number between 10 and 20. Meant to be used as
     * simulated network latency, in milliseconds.
     */
    private delayTime() {
        // Delay 10-20 ms
        return 10 + Math.random() * 10;
    }

    /**
     * Returns an Observable of the data associated with the given table.
     * Throws an HttpErrorResponse just like the real HttpClient + API would do
     * if that table doesn't exist.
     */
    private fetchData(schema: string, table: string): Observable<SqlRow[]> {
        const data = this.data.find((d) => d.schema === schema && d.table === table);

        let obs: Observable<SqlRow[]>;
        if (data === undefined)
            obs = throwError(this.errorResponse({
                res: {
                    message: 'Not found'
                },
                status: 404
            }));
        else
            obs = of(data.data);
        
        return obs.pipe(delay(this.delayTime()));
    }

    /**
     * Generates an HttpErrorResponse that's almost identical to a response
     * generated by Angular's HttpClient and the Helium API.
     */
    private errorResponse(init: { res: ErrorResponse, status: number }): HttpErrorResponse {
        return new HttpErrorResponse({
            error: { error: init.res },
            status: init.status
        });
    }

    /**
     * Turns a TableDef into a TableMeta and data, what consumers of this
     * service expect.
     */
    private static compileTableDef(def: TableDef, names: TableId[]): { data: DataDef, meta: TableMeta } {
        const headers: TableHeader[] = [];
        const constraints: CompoundConstraint[] = [];

        let fkNum = 0;

        for (const field of def.fields) {
            if (field.pk) {
                // This field is a primary key
                constraints.push({
                    name: 'PRIMARY',
                    type: 'primary',
                    constraints: [{
                        localColumn: field.name,
                        type: 'primary',
                        ref: null
                    }]
                });
            } else if (field.fk) {
                // This field is a foreign key
                constraints.push({
                    name: 'mock_fk_' + (fkNum++),
                    type: 'foreign',
                    constraints: [{
                        localColumn: field.name,
                        type: 'foreign',
                        ref: {
                            // Assume the referenced table is in the same schema
                            // if no schema is provided
                            schema: field.fk.schema ? field.fk.schema : def.schema,
                            table: field.fk.table,
                            column: field.fk.col
                        }
                    }]
                });
            }

            let ordinalPosition = 1;
            headers.push(MockApiService.tableHeader(field, ordinalPosition++, def.name));
        }

        const parts = names
            .filter((id) =>
                id.schema === def.schema && id.name.startsWith(def.name + '__'))
            .map((id) => new TableName(id.schema, id.name));

        const meta: TableMeta = {
            schema: def.schema,
            name: def.name,
            headers,
            constraints,
            totalRows: def.totalRows || 0,
            comment: def.comment ? def.comment : '',
            parts
        };

        const fields = _(def.fields)
            .map((f) => f.name)
            .sortBy()
            .value();

        if (def.totalRows && !def.createRow) {
            throw new Error('totalRows was provided, but createRow was not');
        }

        const rows: SqlRow[] = !def.totalRows ? [] : _.range(def.totalRows).map((index) => {
            const row = def.createRow!(index);
            const props = _.sortBy(Object.keys(row));
            if (!_.isEqual(props, fields)) {
                throw new Error(`Row at index ${index} did not specify exactly the fields allowed`);
            }

            return row;
        });

        const data: DataDef = {
            schema: def.schema,
            table: def.name,
            data: rows
        };

        return { meta, data };
    }

    /**
     * Generates a TableHeader based on the given FieldDef.
     */
    private static tableHeader(def: FieldDef, ordinalPosition: number, tableName: string): TableHeader {
        let rawType: string;
        switch (def.type) {
            case 'string':
                rawType = 'varchar(255)';
                break;
            case 'integer':
                rawType = 'int(11)';
                break;
            case 'boolean':
                rawType = 'tinyint(1)';
                break;
            default:
                rawType = def.type;
        }

        const isNumerical = def.type === 'integer' || def.type === 'float';
        return {
            name: def.name,
            type: def.type,
            rawType,
            isNumerical,
            isTextual: def.type === 'string',
            ordinalPosition,
            signed: def.type === 'integer',
            nullable: false,
            maxCharacters: 255,
            charset: 'UTF-8',
            // These don't really matter for now
            numericPrecision: isNumerical ? 10 : null,
            numericScale: isNumerical ? 10 : null,
            // Enums aren't supported right now
            enumValues: null,
            comment: '',
            tableName,
            defaultValue: null
        };
    }
}

interface TableId {
    schema: string;
    name: string;
}

interface TableDef extends TableId {
    fields: FieldDef[];
    totalRows?: number;
    comment?: string;

    /**
     * Generate row `n` this table. Does not have to produce the same result on
     * subsequent calls with the same value for `index`.
     */
    createRow?: (index: number) => SqlRow;
}

interface FieldDef {
    name: string;
    type: TableDataType;
    
    /** If this field is a primary key */
    pk?: boolean;

    /** If not undefined, specifies that this field is a foreign key. */
    fk?: ForeignKeyDef;
}

interface ForeignKeyDef {
    schema?: string;
    table: string;
    col: string;
}

interface DataDef {
    schema: string;
    table: string;
    data: SqlRow[];
}

const mockSchema = 'sample';
const idCol: FieldDef = { name: 'id', type: 'integer', pk: true };
const numManufacturers = 20;
const numProducts = 1000;
const numCustomers = 10000;

const TABLES: TableDef[] = [
    {
        schema: mockSchema,
        name: 'manufacturer',
        fields: [
            idCol,
            { name: 'name', type: 'string' },
            { name: 'hq_addr', type: 'string' },
            { name: 'website', type: 'string' },
            { name: 'specialization', type: 'string' }
        ],
        totalRows: numManufacturers,
        createRow: (id) => ({
            id,
            name: faker.company.companyName(),
            hq_addr: faker.address.streetAddress(),
            website: faker.internet.url(),
            specialization: faker.company.bs()
        })
    },
    {
        schema: mockSchema,
        name: 'product',
        fields: [
            idCol,
            { name: 'name', type: 'string' },
            { name: 'manufactured_by', type: 'integer', fk: { table: 'manufacturer', col: 'id' } },
            { name: 'price', type: 'float' }
        ],
        totalRows: numProducts,
        createRow: (id) => ({
            id,
            name: faker.commerce.product(),
            manufactured_by: Math.floor(Math.random() * numManufacturers),
            price: faker.commerce.price()
        })
    },
    {
        schema: mockSchema,
        name: 'customer',
        fields: [
            idCol,
            { name: 'name', type: 'string' }
        ],
        totalRows: numCustomers,
        createRow: (id) => ({
            id,
            name: faker.name.findName()
        })
    },
    {
        schema: mockSchema,
        name: 'order',
        fields: [
            idCol,
            { name: 'product', type: 'integer', fk: { table: 'product', col: 'id' } },
            { name: 'quantity', type: 'integer' },
            { name: 'purchased_by', type: 'integer', fk: { table: 'customer', col: 'id' } },
            { name: 'purchased_by_ip_addr', type: 'string' }
        ],
        totalRows: 100000,
        createRow: (id) => ({
            id,
            product: Math.floor(Math.random() * numProducts),
            quantity: Math.ceil(Math.random() * 50),
            purchased_by: Math.floor(Math.random() * numCustomers),
            purchased_by_ip_addr: faker.internet.ipv6()
        })
    },
    {
        schema: mockSchema,
        name: 'master',
        fields: [
            idCol
        ],
        totalRows: 0,
    },
    {
        schema: mockSchema,
        name: 'master__part_a',
        fields: [
            idCol,
            { name: 'reference_to_master', type: 'integer', fk: { table: 'master', col: 'id' } }
        ]
    },
    {
        schema: mockSchema,
        name: 'master__part_b',
        fields: [
            idCol,
            { name: 'reference_to_master', type: 'integer', fk: { table: 'master', col: 'id' } }
        ]
    }
];
