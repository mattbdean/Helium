import * as joi from 'joi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { MysqlSquel, ParamString, Select } from 'squel';
import {
    CompoundConstraint, Constraint, ConstraintType, DefaultValue, Filter,
    RawConstraint, SqlRow, TableDataType, TableHeader, TableMeta
} from '../common/api';
import { TableInsert } from '../common/api/table-insert';
import {
    BLOB_STRING_REPRESENTATION, CURRENT_TIMESTAMP, DATE_FORMAT,
    DATETIME_FORMAT
} from '../common/constants';
import { TableName } from '../common/table-name';
import { unflattenTableNames } from '../common/util';
import { QueryHelper } from '../db/query-helper';
import { ValidationError } from '../routes/api/validation-error';
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

    /**
     * A Joi schema that allows up to 100 properties with each key being no
     * longer than 100 characters and each value being no longer than 1000
     * characters
     */
    private static readonly JOI_PLUCK_SELECTORS = joi.object()
        .pattern(/^.{1,100}$/, joi.string().max(1000))
        .max(100);

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
                         filters: Filter[] = []): Promise<{ rows: SqlRow[], count: number }> {

        // Resolve each option to a non-undefined value
        const page: number = opts.page !== undefined ? opts.page : 1;
        const limit: number = opts.limit !== undefined ? opts.limit : 25;
        const sort = opts.sort || null;

        if (page < 1)
            throw new ValidationError('Expecting page >= 1', 'INVALID_LIMIT', { page });

        if (limit < 1)
            throw new ValidationError('Expecting limit < 1', 'INVALID_PAGE', { limit });

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

        const count = await this.count(schema, table, filters);

        // We need access to the table's headers to resolve Dates and blobs to
        // the right string representation
        const headers: TableHeader[] = await this.headers(schema, table);

        return { rows: this.formatData(headers, rows), count };
    }

    /** Fetches a TableMeta instance for the given table. */
    public async meta(schema: string, table: string): Promise<TableMeta> {
        const [allTables, headers, count, constraints, comment] = await Promise.all([
            this.tables(schema),
            this.headers(schema, table),
            this.count(schema, table),
            this.constraints(schema, table)
                .then((result) => this.resolveConstraints(result))
                .then(SchemaDao.resolveCompoundConstraints),
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
            'COLUMN_DEFAULT', 'EXTRA'
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

        // Get the next AUTO_INCREMENT value, or null if there is no column with
        // AUTO_INCREMENT.
        const autoIncValue = (await this.helper.execute((squel) =>
            squel.select()
                .from('INFORMATION_SCHEMA.tables')
                .field('AUTO_INCREMENT')
                .where('TABLE_SCHEMA = ?', schema)
                .where('TABLE_NAME LIKE ?', table)
                .limit(1)
        ))[0]['AUTO_INCREMENT'];

        // Map each BinaryRow into a TableHeader, removing any additional rows
        // that share the same name
        return _.map(result, (row: any): TableHeader => {
            const rawType = row.COLUMN_TYPE as string;
            const type = SchemaDao.parseType(rawType);
            const isNumerical = type === 'integer' || type === 'float';

            // A column is AUTO_INCREMENT'd if the 'EXTRA' column includes the
            // string "auto_increment." Otherwise that value isn't applicable.
            const actualAutoInc = row.EXTRA.indexOf('auto_increment') >= 0 ?
                autoIncValue : null;
            const defaultValue = SchemaDao.identifyDefaultValue(rawType, type, row.COLUMN_DEFAULT, actualAutoInc);

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
     * Gets a list of constraints on a given table. Currently, only primary keys,
     * foreign keys, and unique constraints are recognized.
     */
    public async constraints(schema: string, table: string): Promise<RawConstraint[]> {
        const result = await this.helper.execute((squel) => {
            return squel.select()
                .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE')
                    .field('CONSTRAINT_NAME')
                    .field('ORDINAL_POSITION')
                    .field('COLUMN_NAME')
                    .field('CONSTRAINT_NAME')
                    .field('REFERENCED_TABLE_SCHEMA')
                    .field('REFERENCED_TABLE_NAME')
                    .field('REFERENCED_COLUMN_NAME')
                .where('CONSTRAINT_SCHEMA = ?', schema)
                .where('TABLE_NAME = ?', table)
                .order('ORDINAL_POSITION');
        });

        return _.map(result, (row: any): RawConstraint => {
            let type: ConstraintType = 'foreign';

            if (row.CONSTRAINT_NAME === 'PRIMARY')
                type = 'primary';
            else if (row.CONSTRAINT_NAME === row.COLUMN_NAME)
                type = 'unique';

            return {
                name: row.CONSTRAINT_NAME,
                index: row.ORDINAL_POSITION - 1,
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

    /**
     * Attempts to simplify foreign key reference chains. For example, if
     * tableA.foo (FK) references tableB.bar (PK and FK), and tableB.bar
     * references tableC.baz (PK), the returned array will replace the original
     * Constraint with one that declares tableA.foo as a FK that references the
     * PK tableC.baz.
     *
     * Note that if there are no foreign key constraints this method does
     * nothing.
     *
     * This method is public only for testing.
     */
    public async resolveConstraints(originals: RawConstraint[]): Promise<RawConstraint[]> {
        // Keep tables in cache once we look them up to prevent any unnecessary
        // lookups
        const cache: { [tableId: string]: RawConstraint[] } = {};

        const tableId = (schemaName: string, tableName: string) =>
            `${schemaName}.${tableName}`;

        // Return constraints from cache, otherwise look them up
        const getConstraints = (otherSchema, otherTable: string): Promise<RawConstraint[]> => {
            const id = tableId(otherSchema, otherTable);
            return cache[id] ? Promise.resolve(cache[id]) : this.constraints(otherSchema, otherTable);
        };

        const resolved: RawConstraint[] = [];

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
                // to do now is update the original's FK reference.
                original.ref = previous.ref;
                resolved.push(original);
            }
        }

        return resolved;
    }

    /**
     * Grabs all rows from all part tables belonging to `table`. Assumes
     * DataJoint creates part tables in the same schema as its master. The
     * `selectors` parameter is used to uniquely identify exactly one row from
     * the master table. The keys of this object should be column names, and the
     * values should be specific values that one column has. The most efficient
     * way of specifying `selectors` is by only paying attention to the primary
     * keys of the master table.
     */
    public async pluck(schema: string, table: string, selectors: { [key: string]: string }): Promise<TableInsert> {
        const partTables = await this.partTables(schema, table);
        const headers = await this.headers(schema, table);

        // Find exactly one row that matches the given selectors
        const pluckedRows = await this._pluck(schema, table, selectors, true, headers);
        const referencedRow = pluckedRows[0];

        const pluckedPartTableRows = await Promise.all(partTables.map(async (partTable) => {
            // Pick out the constraints that tell us that a row in this part
            // table belongs to a row in the master table
            const constraints = (await this.constraints(schema, partTable))
                .filter((c) => c.type === 'foreign' && c.ref !== null && c.ref.table === table);

            const partSelectors: { [key: string]: string } = {};

            for (const constraint of constraints) {
                partSelectors[constraint.localColumn] =
                    String(referencedRow[constraint.ref!!.column]);
            }

            return this._pluck(schema, partTable, partSelectors, false,
                await this.headers(schema, partTable));
        }));

        const keys = [table, ...partTables];
        const values = [[referencedRow], ...pluckedPartTableRows];

        // Create an object where property n has key keys[n] and value values[n]
        const everything = _.zipObject(keys, values);

        // Don't include the part tables where there are no rows belonging to
        // the referenced row
        return _.pickBy(everything, (rows) => rows.length > 0) as TableInsert;
    }

    /**
     * Attempts to find rows that match the given criteria. See the main `pluck`
     * method documentation for how `selectors` should work. If `singleRow` is
     * true, then this method throws a ValidationError if the query returns
     * anything other than exactly one row.
     */
    private async _pluck(
        schema: string,
        table: string,
        selectors: { [key: string]: string },
        singleRow: boolean,
        headers: TableHeader[]
    ): Promise<SqlRow[]> {
        // Make sure `selectors` is actually an object mapping strings to strings
        joi.assert(selectors, SchemaDao.JOI_PLUCK_SELECTORS);

        const result = await this.helper.execute(((squel) => {
            let query = squel.select()
                .from(this.helper.escapeId(schema) + '.' + this.helper.escapeId(table));

            for (const fieldName of Object.keys(selectors)) {
                query = query.where(this.helper.escapeId(fieldName) + ' = ?', selectors[fieldName]);
            }

            return query;
        }));

        if (singleRow && result.length !== 1) {
            throw new ValidationError('Provided constraints did not produce ' +
                'exactly 1 result, got ' + result.length,
                'CONSTRAINT_SPECIFICITY', { selectors });
        }

        return this.formatData(headers, result);
    }

    private formatData(headers: TableHeader[], rows: SqlRow[]): SqlRow[] {
        const blobHeaders = _(headers)
            .filter((h) => h.type === 'blob')
            .map((h) => h.name)
            .value();

        return rows.map((row): SqlRow => {
            const newRow = _.clone(row);
            for (const col of Object.keys(row)) {
                if (newRow[col] instanceof Date) {
                    const header = _.find(headers, (h) => h.name === col);
                    if (header === undefined)
                        throw Error(`Could not find header with name ${col}`);

                    if (header.type === 'date')
                        newRow[col] = moment(row[col]).format(DATE_FORMAT);
                    else if (header.type === 'datetime')
                        newRow[col] = moment(row[col]).format(DATETIME_FORMAT);
                    else
                        throw Error(`Header ${header.name} unexpectedly had a Date value in it`);
                } else if (blobHeaders.indexOf(col) >= 0) {
                    // Don't send the actual binary data, send a specific string
                    // instead
                    newRow[col] = BLOB_STRING_REPRESENTATION;
                }
            }

            return newRow;
        });
    }

    /**
     * Resolves to a list of part tables that belong to the given master table.
     * All table names are presented as they appear in SQL. They are not the
     * "clean" DataJoint version. For example, "foo__bar" could be an element
     * in the returned array, but "Foo.Bar" would not be.
     */
    private async partTables(schema: string, masterTable: string): Promise<string[]> {
        const query = `SHOW TABLES FROM ${this.helper.escapeId(schema)} LIKE ` +
            this.helper.escape(masterTable + '__%');

        return (await this.helper.executeRaw(query))
            .map((row: SqlRow): string => row[Object.keys(row)[0]]);
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

    /** Fetches a table's comment, or an empty string if none exists */
    private async comment(schema: string, table: string): Promise<string> {
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from('INFORMATION_SCHEMA.TABLES')
                .field('TABLE_COMMENT')
                .where('TABLE_NAME = ?', table)
                .where('TABLE_SCHEMA = ?', schema)
        );

        return result.length > 0 ? result[0].TABLE_COMMENT : '';
    }

    /** Counts the amount of rows in a table */
    private async count(schema: string, table: string, filters: Filter[] = []): Promise<number> {
        const result = await this.helper.execute((squel) => {
            const query = squel.select()
                .from(this.helper.escapeId(schema) + '.' + this.helper.escapeId(table))
                .field('COUNT(*)');

            for (const filter of filters) {
                this.addFilter(query, filter);
            }

            return query;
        });
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

    public static resolveCompoundConstraints(originals: RawConstraint[]): CompoundConstraint[] {
        const grouped = _.groupBy(originals, 'name');

        const resolved: CompoundConstraint[] = [];

        for (const constraintName of Object.keys(grouped)) {
            const constraints = grouped[constraintName];

            const orderedConstraints: Constraint[] = [];

            let type: ConstraintType | undefined;
            let name: string | undefined;

            for (const constraint of constraints) {
                if (type === undefined)
                    type = constraint.type;
                if (name === undefined)
                    name = constraint.name;

                // Make sure the constraint index is in bounds
                if (constraint.index >= constraints.length) {
                    throw new Error(`Invalid index for constraint ${constraintName}: ` +
                        `${constraint.index}. Expecting a value in the range 0..${constraints.length - 1}`);
                } else if (constraint.index < 0) {
                    throw new Error(`Invalid index for constraint ${constraintName}: ` +
                        `${constraint.index}. Expecting a non-negative value.`);
                }

                // Make sure we're not overwriting existing data
                if (orderedConstraints[constraint.index])
                    throw new Error(`Duplicate index for constraint ${constraintName}:` + 
                        constraint.index);

                orderedConstraints[constraint.index] = {
                    localColumn: constraint.localColumn,
                    ref: constraint.ref,
                    type: constraint.type
                };
            }

            resolved.push({
                type: type!!,
                name: name!!,
                constraints: orderedConstraints,
            });
        }

        return resolved;
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

    private static identifyDefaultValue(
        rawType: string,
        type: TableDataType,
        rawDefault: string,
        autoIncValue: number | null
    ): DefaultValue {
        if (autoIncValue !== null)
            return autoIncValue;
        if (rawDefault === CURRENT_TIMESTAMP && (rawType === 'datetime' || rawType === 'timestamp'))
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
