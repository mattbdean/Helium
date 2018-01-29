import * as _ from 'lodash';
import * as moment from 'moment';
import { Select } from 'squel';

import {
    Constraint, ConstraintType, DefaultValue, Filter, SqlRow, TableDataType,
    TableHeader, TableMeta
} from '../../../common/api';
import {
    BLOB_STRING_REPRESENTATION, CURRENT_TIMESTAMP, DATE_FORMAT,
    DATETIME_FORMAT
} from '../../../common/constants';
import { TableName } from '../../../common/table-name.class';
import { unflattenTableNames } from '../../../common/util';
import { QueryHelper } from '../../../db/query-helper';
import { ValidationError } from '../validation-error';
import { TableInputValidator } from './schema-input.validator';

/**
 * Simple interface for describing the way some data is to be organized.
 *
 * In the case of a method rejecting with a MySQL-related error, the Error
 * object will have a `code` property. Here are some of the common values:
 *
 *  - ER_DBACCESS_DENIED_ERROR (the schema doesn't exist or is inaccessible
 *    to the user)
 *  - ER_NO_SUCH_TABLE (the table doesn't exist)
 *  - ER_BAD_FIELD_ERROR (a requested column doesn't exist on the table)
 *  - ER_TABLEACCESS_DENIED_ERROR
 *  - ER_UNKNOWN_TABLE
 */
export interface Sort {
    direction: 'asc' | 'desc';
    /** Name of the column to sort by */
    by: string;
}

export class SchemaDao {
    private static readonly SIMPLE_FILTER_OP_MAPPING: { [op: string]: string } = {
        lt: '<',
        gt: '>',
        eq: '='
    };
    private validator: TableInputValidator;

    public constructor(private helper: QueryHelper) {
        this.validator = new TableInputValidator(this);
    }

    public async schemas(): Promise<string[]> {
        return (await this.helper.executeRaw('SHOW SCHEMAS;'))
            .map((row: SqlRow) => row[Object.keys(row)[0]]);
    }

    /**
     * Returns an array of all available table names
     *
     * If this Promise rejects due to a MySQL-related error, the resulting Error
     * object will have a code property most likely equal to
     * 'ER_DBACCESS_DENIED_ERROR', in the case that the schema doesn't exist or
     * the user doesn't have the ability to view that schema.
     */
    public async tables(db: string): Promise<TableName[]> {
        const result = await this.helper.executeRaw('SHOW TABLES FROM ' + this.helper.escapeId(db));
        return _.map(result, (row: SqlRow): TableName => new TableName(db, row[Object.keys(row)[0]]));
    }

    /**
     * Fetches the data from the table
     *
     * @param {string} schema Database name
     * @param {string} table Table name
     * @param {object} opts Additional options
     * @param {number} opts.page Which page to request. Pages are 1-indexed, so
     * 0 is an invalid page, 1 is the first page, 2 is the second, and so on. A
     * "page" is pretty arbitrary since what data is included depends heavily on
     * `limit`.
     * @param {number} opts.limit How many rows to fetch in one go
     * @param {Sort} opts.sort If provided, will attempt to sort the results by
     * this column/direction
     * @param {Filter} filters Specify constraints on what data to retrieve
     * @returns {Promise<SqlRow[]>} A promise that resolves to the requested
     * data
     */
    public async content(schema: string,
                         table: string,
                         opts: { page?: number, limit?: number, sort?: Sort} = {},
                         filters: Filter[] = []): Promise<SqlRow[]> {

        // Resolve each option to a non-undefined value
        const page: number = opts.page !== undefined ? opts.page : 1;
        const limit: number = opts.limit !== undefined ? opts.limit : 25;
        const sort = opts.sort || null;

        if (page < 1)
            throw new ValidationError('Expecting page >= 1', 'INVALID_LIMIT', { page });

        if (limit < 0)
            throw new ValidationError('Expecting limit < 0', 'INVALID_PAGE', { limit });

        const rows = await this.helper.execute((squel) => {
            // Create our basic query
            let query = squel
                .select()
                // Make sure we escape the table name so that we're less vulnerable to
                // SQL injection
                .from(this.helper.escapeId(schema) + '.' + this.helper.escapeId(table))
                // Pagination
                .limit(limit)
                .offset((page - 1) * limit);

            if (sort !== null) {
                // Specify a sort if provided
                query = query.order(this.helper.escapeId(sort.by), sort.direction === 'asc');
            }

            for (const filter of filters) {
                query = this.addFilter(query, filter);
            }

            return query;
        });

        // If there's no data being returned and this isn't the first page,
        // we've gone past the last page.
        if (rows.length === 0 && page !== 1)
            throw new ValidationError(`Page too high: ${page}`, 'INVALID_PAGE');

        // We need access to the table's headers to resolve Dates and blobs to
        // the right string representation
        const headers: TableHeader[] = await this.headers(schema, table);
        const blobHeaders = _(headers)
            .filter((h) => h.type === 'blob')
            .map((h) => h.name)
            .value();

        for (const row of rows) {
            for (const col of Object.keys(row)) {
                if (row[col] instanceof Date) {
                    const header = _.find(headers, (h) => h.name === col);
                    if (header === undefined)
                        throw Error(`Could not find header with name ${col}`);

                    if (header.type === 'date')
                        row[col] = moment(row[col]).format(DATE_FORMAT);
                    else if (header.type === 'datetime')
                        row[col] = moment(row[col]).format(DATETIME_FORMAT);
                    else
                        throw Error(`Header ${header.name} unexpectedly had a Date value in it`);
                } else if (blobHeaders.indexOf(col) >= 0) {
                    // Don't send the actual binary data, send a specific string
                    // instead
                    row[col] = BLOB_STRING_REPRESENTATION;
                }
            }
        }

        return rows;
    }

    /** Fetches a TableMeta instance for the given table. */
    public async meta(schema: string, table: string): Promise<TableMeta> {
        const [allTables, headers, count, constraints, comment] = await Promise.all([
            this.tables(schema),
            this.headers(schema, table),
            this.count(schema, table),
            // For some reason `this` becomes undefined in the resolveConstraints
            // function if we do this.constraints(name).then(this.resolveConstraints)
            this.constraints(schema, table).then((result) => this.resolveConstraints(result)),
            this.comment(schema, table)
        ]);

        // Identify part tables for the given table name
        const masterTables = unflattenTableNames(allTables);
        const masterTable = masterTables.find((t) => t.name.raw === table);
        const parts = masterTable ? masterTable.parts : [];

        return {
            schema,
            name: table,
            headers,
            totalRows: count,
            constraints,
            comment,
            parts
        };
    }

    /**
     * Fetches all distinct values from one column. Useful for autocomplete.
     */
    public async columnContent(schema: string, table: string, column: string):
        Promise<Array<string | number>> {

        // SELECT DISTINCT $col FROM $table ORDER BY $col ASC
        const result = await this.helper.execute((squel) =>
            squel
                .select()
                .distinct()
                .from(this.helper.escapeId(schema) + '.' + this.helper.escapeId(table))
                .field(this.helper.escapeId(column))
                .order(this.helper.escapeId(column))
        );

        // Each row is a document mapping the column to its value. In this case, we
        // only have one item in the row, flatten the array of objects into an array
        // of each value
        return _.map(result, (row) => row[column]);
    }

    /**
     * Inserts a row into a given table. The given data will be verified before
     * inserting.
     */
    public async insertRow(schema: string, data: any) {
        // Make sure that the given data adheres to the headers
        const preparedData = await this.validator.validate(schema, data);

        return this.helper.transaction(async (conn) => {
            // Make sure we alphabetize the names so we insert master tables first
            const names = _.sortBy(Object.keys(preparedData));

            // Do inserts in sequence so we can guarantee that master tables
            // are inserted before any part tables
            for (const tableName of names) {
                if (preparedData[tableName].length === 0)
                    continue;

                // Prepare each row for insertion. Escape column names, transform
                // values as appropriate, etc.
                const rows = preparedData[tableName].map(this.prepareForInsert, this);

                await this.helper.execute((squel) => {
                    return squel.insert()
                        .into(this.helper.escapeId(schema) + '.' + this.helper.escapeId(tableName))
                        .setFieldsRows(rows);
                }, conn);
            }
        });
    }

    /**
     * Returns a Promise the resolves to an array of TableHeaders. Note that
     * `name` is used in a 'LIKE' expression and therefore can contain
     * metacharacters like '%'.
     */
    public async headers(schema: string, table: string): Promise<TableHeader[]> {
        const fields = [
            'COLUMN_NAME', 'ORDINAL_POSITION', 'IS_NULLABLE', 'DATA_TYPE',
            'CHARACTER_MAXIMUM_LENGTH', 'NUMERIC_SCALE', 'NUMERIC_PRECISION',
            'CHARACTER_SET_NAME', 'COLUMN_TYPE', 'COLUMN_COMMENT', 'TABLE_NAME',
            'COLUMN_DEFAULT'
        ];

        const result = await this.helper.execute((squel) => {
            let query = squel.select().from('INFORMATION_SCHEMA.columns');

            for (const field of fields) {
                query = query.field(field);
            }

            return query
                .where('TABLE_SCHEMA = ?', schema)
                .where('TABLE_NAME LIKE ?', table)
                .order('ORDINAL_POSITION');
        });

        // Map each BinaryRow into a TableHeader, removing any additional rows
        // that share the same name
        return _.map(result, (row: any): TableHeader => {
            const rawType = row.COLUMN_TYPE as string;
            const type = SchemaDao.parseType(rawType);
            const isNumerical = type === 'integer' || type === 'float';
            const defaultValue = SchemaDao.identifyDefaultValue(rawType, type, row.COLUMN_DEFAULT);

            return {
                name: row.COLUMN_NAME as string,
                type,
                isNumerical,
                isTextual: !isNumerical,
                signed: isNumerical && !rawType.includes('unsigned'),
                ordinalPosition: row.ORDINAL_POSITION as number,
                rawType,
                defaultValue,
                nullable: row.IS_NULLABLE === 'YES',
                maxCharacters: row.CHARACTER_MAXIMUM_LENGTH as number,
                charset: row.CHARACTER_SET_NAME as string,
                numericPrecision: row.NUMERIC_PRECISION as number,
                numericScale: row.NUMERIC_SCALE as number,
                enumValues: SchemaDao.findEnumValues(row.COLUMN_TYPE as string),
                comment: row.COLUMN_COMMENT as string,
                tableName: row.TABLE_NAME as string
            };
        });
    }

    /**
     * Attempts to simplify foreign key reference chains. For
     * example, if tableA.foo (FK) references tableB.bar (PK and FK), and
     * tableB.bar references tableC.baz (PK), the returned array will replace
     * the original Constraint with one that declares tableA.foo as a FK
     * that references the PK tableC.baz.
     *
     * Note that if there are no foreign key constraints this method does
     * nothing.
     *
     * This method is public only for testing.
     */
    public async resolveConstraints(originals: Constraint[]): Promise<Constraint[]> {
        // Keep tables in cache once we look them up to prevent any unnecessary
        // lookups
        const cache: { [tableId: string]: Constraint[] } = {};

        const tableId = (schemaName: string, tableName: string) =>
            `${schemaName}.${tableName}`;

        // Return constraints from cache, otherwise look them up
        const getConstraints = (otherSchema, otherTable: string): Promise<Constraint[]> => {
            const id = tableId(otherSchema, otherTable);
            return cache[id] ? Promise.resolve(cache[id]) : this.constraints(otherSchema, otherTable);
        };

        const resolved: Constraint[] = [];

        for (const c of originals) {
            // We're only operating on foreign keys here
            if (c.type !== 'foreign') {
                resolved.push(c);
                continue;
            }

            const findConstraint = (localColumn: string, others: Constraint[]): Constraint => {
                const temp = _.find(others, (other: Constraint) => other.localColumn === localColumn);
                if (temp === undefined)
                    throw new Error(`could not find constraint with name '${localColumn}'`);
                return temp;
            };

            const original = c;
            let current: Constraint = c;
            let previous: Constraint | undefined;

            // Navigate up the hierarchy until we find a PK constraint.
            while (current.type !== 'primary') {
                previous = current;
                current = findConstraint(current.ref!!.column,
                    await getConstraints(current.ref!!.schema, current.ref!!.table));
            }

            if (previous !== undefined) {
                // We've found the last FK in the reference chain. All we have
                // to do now is update the localColumn to the original's
                previous.localColumn = original.localColumn;
                resolved.push(previous);
            }
        }

        return resolved;
    }

    /**
     * Returns a new SqlRow whose keys are escaped as if they were reserved
     * keywords and whose values have been transformed by {@link #prepareValue}
     */
    private prepareForInsert(validated: SqlRow): SqlRow {
        const result: SqlRow = {};
        for (const columnName of Object.keys(validated)) {
            // Escape the name of the column in case that name is a reserved
            // MySQL keyword like "integer."
            result[this.helper.escapeId(columnName)] = SchemaDao.prepareValue(validated[columnName]);
        }

        return result;
    }

    /**
     * Gets a list of constraints on a given table. Currently, only primary keys,
     * foreign keys, and unique constraints are recognized.
     */
    private async constraints(schema: string, table: string): Promise<Constraint[]> {
        const result = await this.helper.execute((squel) => {
            return squel.select()
                .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE')
                    .field('COLUMN_NAME')
                    .field('CONSTRAINT_NAME')
                    .field('REFERENCED_TABLE_SCHEMA')
                    .field('REFERENCED_TABLE_NAME')
                    .field('REFERENCED_COLUMN_NAME')
                .where('CONSTRAINT_SCHEMA = ?', schema)
                .where('TABLE_NAME = ?', table)
                .order('ORDINAL_POSITION');
        });

        return _.map(result, (row: any): Constraint => {
            let type: ConstraintType = 'foreign';

            if (row.CONSTRAINT_NAME === 'PRIMARY')
                type = 'primary';
            else if (row.CONSTRAINT_NAME === row.COLUMN_NAME)
                type = 'unique';

            return {
                type,
                localColumn: row.COLUMN_NAME as string,
                ref: type !== 'foreign' ? null : {
                    schema: row.REFERENCED_TABLE_SCHEMA as string,
                    table: row.REFERENCED_TABLE_NAME as string,
                    column: row.REFERENCED_COLUMN_NAME as string
                }
            };
        });
    }

    /** Fetches a table's comment, or an empty string if none exists */
    private async comment(schema: string, table: string): Promise<string> {
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from('INFORMATION_SCHEMA.TABLES')
                .field('TABLE_COMMENT')
                .where('TABLE_NAME = ?', table)
                .where('TABLE_SCHEMA = ?', schema)
        );

        return result[0].TABLE_COMMENT;
    }

    /** Counts the amount of rows in a table */
    private async count(schema: string, table: string): Promise<number> {
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from(this.helper.escapeId(schema) + '.' + this.helper.escapeId(table))
                .field('COUNT(*)')
        );
        // This query returns only one row
        return result[0]['COUNT(*)'];
    }

    private addFilter(query: Select, filter: Filter): Select {
        const simpleOp: string | undefined = SchemaDao.SIMPLE_FILTER_OP_MAPPING[filter.op];

        if (simpleOp === undefined) {
            const { op, value } = filter;
            if (value !== 'null')
                throw new Error(`Unknown value for filter operation ${op}: ${value}`);

            if (op === 'is')
                return query.where(`${this.helper.escapeId(filter.param)} IS NULL`);
            else if (op === 'isnot')
                return query.where(`${this.helper.escapeId(filter.param)} IS NOT NULL`);
            else
                throw new Error(`Unknown filter operation: ${filter.op}`);
        }

        return query.where(`${this.helper.escapeId(filter.param)} ${simpleOp} ?`, filter.value);
    }

    /**
     * Transform simple JS types into their real MySQL values. Right now, all
     * this does is turn the boolean `true` into the number `1` and the boolean
     * `false` into the number `0`. All other values are returned unmodified.
     */
    private static prepareValue(v: any): any {
        if (typeof v === 'boolean')
            return v ? 1 : 0;
        return v;
    }

    private static identifyDefaultValue(rawType: string, type: TableDataType, rawDefault: string): DefaultValue {
        if (rawDefault === CURRENT_TIMESTAMP && rawType === 'datetime')
            return { constantName: CURRENT_TIMESTAMP };

        switch (type) {
            case 'integer':
                return parseInt(rawDefault, 10);
            case 'float':
                return parseFloat(rawDefault);
            case 'boolean':
                return !!parseInt(rawDefault, 10);
            // We don't have to do anything for textual columns
            case 'string':
            case 'enum':
            case 'date':
            case 'datetime':
                return rawDefault;
            case 'blob':
                // Don't leak any blob data
                return null;
        }

        throw new Error(`Could not determine default header for type=${type}`);
    }

    private static parseType(rawType: string): TableDataType {
        if (rawType.includes('tinyint(1)')) return 'boolean';
        if (rawType.includes('int')) return 'integer';
        if (rawType.includes('double') || rawType.includes('float') || rawType.includes('decimal')) return 'float';
        if (rawType === 'date') return 'date';
        if (rawType === 'datetime' || rawType === 'timestamp') return 'datetime';
        if (rawType.startsWith('enum')) return 'enum';
        if (rawType.includes('char') || rawType.includes('text')) return 'string';
        if (rawType.includes('blob')) return 'blob';

        throw Error(`Could not determine TableDataType for raw type '${rawType}'`);
    }

    private static findEnumValues(raw: string): string[] | null {
        if (!/^enum\(/.test(raw)) return null;
        const matches = raw.match(/^enum\('(.*)'\)$/);
        if (matches === null || matches.length !== 2)
            throw new Error(`Expecting a match from input string ${raw}`);
        return matches[1].split('\',\'');
    }
}
