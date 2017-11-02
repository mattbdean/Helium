import * as BaseJoi from 'joi';
import { AnySchema, Schema } from 'joi';
import * as JoiDateExtensions from 'joi-date-extensions';
import * as _ from 'lodash';
import * as moment from 'moment';
import { FunctionBlock } from 'squel';

import {
    Constraint, ConstraintType, DefaultValue, SqlRow, TableDataType,
    TableHeader, TableMeta, TableName
} from '../../common/api';
import {
    BLOB_STRING_REPRESENTATION, CURRENT_TIMESTAMP, DATE_FORMAT,
    DATETIME_FORMAT
} from '../../common/constants';
import { createTableName, unflattenTableNames } from '../../common/util';
import { Database } from '../../db/database.helper';

const joi = BaseJoi.extend(JoiDateExtensions);

/**
 * Simple interface for describing the way some data is to be organized
 */
export interface Sort {
    direction: 'asc' | 'desc';
    /** Name of the column to sort by */
    by: string;
}

/**
 * A PreparedInsert keeps track of all data that needs to be inserted. The
 * keys for this object are the names of the tables as they appear in SQL.
 * Each table can have multiple rows of data to insert. For example, a
 * PreparedInsert for one row on a table 'foo' with textual columns 'bar' and
 * 'baz' might look something like this:
 *
 * {
 *   foo: [
 *     [
 *       { key: 'bar': value: 'hello', dontQuote: false }
 *       { key: 'baz': value: 'world', dontQuote: false }
 *     ]
 *   ]
 * }
 */
interface PreparedInsert {
    [table: string]: SqlRow[];
}

interface PartTableHeaders { [partTableName: string]: TableHeader[]; }

type PreparedCell = string | number | boolean | FunctionBlock;

interface PreparedRow {
    [columnName: string]: PreparedCell;
}

export class TableDao {
    public constructor(private helper: Database) {}

    /**
     * Returns an array of all available table names
     */
    public async list(): Promise<TableName[]> {
        // db.conn is a PromiseConnection that wraps a Connection. A
        // Connection has a property `config`
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from('INFORMATION_SCHEMA.tables')
                .field('table_name')
                .where('TABLE_SCHEMA = ?', this.helper.databaseName()));

        /*
        Transform this:
        [
            { table_name: 'foo' },
            { table_name: '#bar' },
            { table_name: '_baz' }
        ]

        Into an array of TableNames:
        [
            { rawName: 'foo', ... }
            { rawName: '#bar', ... }
            { rawName: '_baz', ... }
        ]
         */
        return _.map(result, (row: any): TableName => createTableName(row.table_name));
    }

    /**
     * Fetches the data from the table
     *
     * @param {string} name Table name
     * @param {number} page Which page to request. Pages are 1-indexed, so 0 is
     * an invalid page, 1 is the first page, 2 is the second, and so on. A "page"
     * is pretty arbitrary since what data is included depends heavily on
     * `limit`.
     *
     * @param {number} limit How many rows to fetch in one go
     * @param {Sort} sort If provided, will attempt to sort the results by this
     * column/direction
     * @returns {Promise<SqlRow[]>} A promise that resolves to the requested data
     */
    public async content(name: string,
                         page: number = 1,
                         limit: number = 25,
                         sort?: Sort | undefined): Promise<SqlRow[]> {

        const rows = await this.helper.execute((squel) => {
            // Create our basic query
            let query = squel
                .select()
                // Make sure we escape the table name so that we're less vulnerable to
                // SQL injection
                .from(this.helper.escapeId(name))
                // Pagination
                .limit(limit)
                .offset((page - 1) * limit);

            if (sort !== undefined) {
                // Specify a sort if provided
                query = query.order(this.helper.escapeId(sort.by), sort.direction === 'asc');
            }

            return query;
        });

        // We need access to the table's headers to resolve Dates and blobs to
        // the right string representation
        const headers: TableHeader[] = await this.headers(name);
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

    /**
     * Fetches a TableMeta instance for the given table.
     */
    public async meta(name: string): Promise<TableMeta> {
        const [allTables, headers, count, constraints, comment] = await Promise.all([
            this.list(),
            this.headers(name),
            this.count(name),
            // For some reason `this` becomes undefined in the resolveConstraints
            // function if we do this.constraints(name).then(this.resolveConstraints)
            this.constraints(name).then((result) => this.resolveConstraints(result)),
            this.comment(name)
        ]);

        // Identify part tables for the given table name
        const masterTables = unflattenTableNames(allTables);
        const masterTable = masterTables.find((t) => t.rawName === name);
        const parts = masterTable ? masterTable.parts : [];

        return {
            name,
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
    public async columnContent(table: string, column: string): Promise<Array<string | number>> {
        // SELECT DISTINCT $col FROM $table ORDER BY $col ASC
        const result = await this.helper.execute((squel) =>
            squel
                .select()
                .distinct()
                .from(this.helper.escapeId(table))
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
    public async insertRow(table: string, data: SqlRow) {
        const headers = await this.headers(table);
        if (headers.length === 0) {
            const error = new Error('no such table') as any;
            error.isInternal = true;
            error.code = 'NO_SUCH_TABLE';
            throw error;
        }
        const parts = await this.partTableHeaders(table);

        // Make sure that the given data adheres to the headers
        const schema = this.compileSchemaFor(headers, parts);
        joi.assert(data, schema);

        const preparedData: PreparedInsert = this.prepareForInsert(headers, parts, data);

        return this.helper.transaction(async () => {
            // Make sure we alphabetize the names so we insert master tables first
            const names = _.sortBy(Object.keys(preparedData));

            // Do inserts in sequence so we can guarantee that master tables
            // are inserted before any part tables
            for (const name of names) {
                const rows = preparedData[name];

                await this.helper.execute((squel) => {
                    return squel.insert()
                        .into(this.helper.escapeId(name))
                        .setFieldsRows(rows);
                });
            }
        });
    }

    /**
     * Creates a Joi schema that can be used to validate the structure of the
     * data sent to be inserted into the database. The general idea here that
     * each column is its own property in the data object. If a table had
     * columns `foo` and `bar`, the user could send data that looks like this:
     *
     * { foo: <something>, bar: <something> }
     *
     * What each <something> is allowed to be is determined by the type of data
     * allowed in that column. For example, if the `foo` column is an unsigned
     * integer, the values 1, 100, and 42 would be accepted, while -1, 'false',
     * and `[]` (an array) would not. Unknown properties are not allowed, so if
     * a table had columns 'foo' and 'bar', one could not specify a 'baz'
     * property.
     *
     * Part tables are supported via the special property `$parts`. If a master
     * table with the SQL name `foo` has two part tables with SQL names
     * `foo__bar` and `foo__baz`, then the user could submit data with this
     * shape:
     *
     * {
     *   <foo properties>,
     *   $parts: {
     *     bar: [
     *       <bar object 1>,
     *       <bar object 2>,
     *       etc.
     *     ],
     *     baz: [
     *       <bar object 1>,
     *       <bar object 2>,
     *       etc.
     *     ]
     *   }
     * }
     *
     * $parts.bar and $parts.baz are optional and if specified, can contain zero
     * or more objects that fit the schema for that specific table. Note that
     * $parts.bar[n].$parts is NOT valid since nested part tables aren't
     * supported by DataJoint and therefore neither by this project.
     *
     * If a master table has no part tables, `$parts` is not allowed.
     *
     * @param headers The master table's headers
     * @param partTableHeaders An object that maps the clean name of each part
     *                         table to all of that table's headers.
     */
    private compileSchemaFor(headers: TableHeader[], partTableHeaders: PartTableHeaders): Schema {

        // There could be a column called $parts, ignore this
        headers = _.filter(headers, (h) => h.name !== '$parts');
        const keys = _.map(headers, (h) => h.name);
        const values = _.map(headers, this.schemaFromHeader);

        // Make all non-nullable properties required
        for (let i = 0; i < headers.length; i++) {
            if (!headers[i].nullable && headers[i].type !== 'blob')
                values[i] = values[i].required();
        }

        // Create an object by like this:
        // { [keys[0]]: values[0], [keys[1]]: values[1], [keys[n]]: values[n] }
        const currentSchema = _.zipObject(keys, values) as any;

        // See if this table has any part tables
        const partTableNames = Object.keys(partTableHeaders);
        if (partTableNames.length > 0) {
            // Do the same thing we did above, create an object by zipping the
            // contents of two arrays together
            const ptableKeys = partTableNames;

            // Recursively call this method to generate a Schema for each part table.
            // In theory, this method could be recursed several times, but in
            // practice, DataJoint does not allow part tables of part tables.
            const ptableValues = _.map(partTableNames, (name) => {
                return joi.array().items(this.compileSchemaFor(partTableHeaders[name], {}));
            });

            // Allow any part tables to be specified using the $parts key
            currentSchema.$parts = joi.object(_.zipObject(ptableKeys, ptableValues)).optional();
        }

        return joi.object(currentSchema);
    }

    /**
     * Creates a schema that validates the value of a particular header. For
     * example, a header representing an unsigned integer column would create
     * a schema that accepts only positive integers when given to this function.
     *
     * Dates are expected to have the format 'YYYY-MM-DD' and similarly,
     * datetimes should have the format 'YYYY-MM-DD HH:mm:ss'.
     *
     * Most data types are pretty straightforward, (var)char headers produce
     * string-based schemas, tinyint(1) headers produce boolean schemas etc.
     *
     * Blobs are a special case, however. Due to the unnecessary security risk
     * of accepting blobs at face value, blobs are forbidden unless the column
     * is nullable and the value is null.
     */
    private schemaFromHeader(h: TableHeader): AnySchema {
        switch (h.type) {
            case 'string':
                return joi.string()
                    .min(0)
                    .max(h.maxCharacters !== null ? h.maxCharacters : Infinity);
            case 'integer':
            case 'float':
                // TODO: Handle maximum values for integers/floats
                let base = joi.number();
                if (h.signed) {
                    base = base.min(0);
                }
                if (h.type === 'integer')
                    base = base.integer();
                return base;
            case 'date':
                return joi.date().format('YYYY-MM-DD');
            case 'datetime':
                return joi.date().format('YYYY-MM-DD HH:mm:ss');
            case 'boolean':
                return joi.boolean();
            case 'enum':
                const schema = joi.string();
                return schema.only.apply(schema, h.enumValues!!);
            case 'blob':
                // Only allow a value of null to be inserted when the header
                // explicitly marks it as nullable. Accepting blobs could be
                // very dangerous and isn't necessary right now.
                return h.nullable ? joi.only(null) : joi.forbidden();
            default:
                throw Error('Unknown data type: ' + h.type);
        }
    }

    /**
     * Gets a list of constraints on a given table. Currently, only primary keys,
     * foreign keys, and unique constraints are recognized.
     */
    private async constraints(name: string): Promise<Constraint[]> {
        const result = await this.helper.execute((squel) => {
            return squel.select()
                .from('INFORMATION_SCHEMA.KEY_COLUMN_USAGE')
                    .field('COLUMN_NAME')
                    .field('CONSTRAINT_NAME')
                    .field('REFERENCED_TABLE_NAME')
                    .field('REFERENCED_COLUMN_NAME')
                .where('CONSTRAINT_SCHEMA = ?', this.helper.databaseName())
                .where('TABLE_NAME = ?', name)
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
                foreignTable: row.REFERENCED_TABLE_NAME as string,
                foreignColumn: row.REFERENCED_COLUMN_NAME as string
            };
        });
    }

    /**
     * Attempts to resolve foreign key constraints to their origins. For example,
     * if tableA.foo references tableB.bar and tableB.bar references tableC.baz,
     * the returned array will include a Constraint that maps tableA.foo to
     * tableC.baz instead of tableB.bar.
     *
     * Note that if there are no foreign key constraints
     */
    private async resolveConstraints(originals: Constraint[]): Promise<Constraint[]> {
        // Keep tables in cache once we look them up to prevent any unnecessary
        // lookups
        const cache: { [tableName: string]: Constraint[] } = {};

        // Return constraints from cache, otherwise look them up
        const getConstraints = (name: string): Promise<Constraint[]> => {
            return cache[name] ? Promise.resolve(cache[name]) : this.constraints(name);
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

            let current: Constraint = c;
            let previous: Constraint | undefined;

            // Navigate up the hierarchy until we find a PK constraint.
            while (current.type !== 'primary') {
                previous = current;
                current = findConstraint(current.foreignColumn!!, await getConstraints(current.foreignTable!!));
            }

            if (previous !== undefined)
                resolved.push(previous);
        }

        return resolved;
    }

    /** Fetches a table's comment, or an empty string if none exists */
    private async comment(name: string): Promise<string> {
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from('INFORMATION_SCHEMA.TABLES')
                .field('TABLE_COMMENT')
                .where('TABLE_NAME = ?', name)
                .where('TABLE_SCHEMA = ?', this.helper.databaseName())
        );

        return result[0].TABLE_COMMENT;
    }

    /** Counts the amount of rows in a table */
    private async count(name: string): Promise<number> {
        const result = await this.helper.execute((squel) =>
            squel.select()
                .from(this.helper.escapeId(name))
                .field('COUNT(*)')
        );
        // This query returns only one row
        return result[0]['COUNT(*)'];
    }

    /**
     * Fetches the TableHeaders for all the part tables belonging to a given
     * master table. For example, if the database contains three tables `foo`,
     * `foo__bar`, and `foo__baz`, `partTableHeaders('foo')` will return this:
     *
     * {
     *   bar: [ <all headers for foo__bar> ],
     *   baz: [ <all headers for foo__baz> ]
     * }
     */
    private async partTableHeaders(masterName: string): Promise<PartTableHeaders> {
        // '%' is a SQL metacharacter that matches 0 or more characters, so
        // 'foo__%' will return any headers associated with the part tables of
        // 'foo'.
        const partHeaders = await this.headers(masterName + '__%');

        // Group the headers by their table names
        const grouped: PartTableHeaders = {};

        for (const header of partHeaders) {
            const cleanName = createTableName(header.tableName).cleanName;

            if (grouped[cleanName] === undefined)
                grouped[cleanName] = [header];
            else
                grouped[cleanName].push(header);
        }

        return grouped;
    }

    /**
     * Returns a Promise the resolves to an array of TableHeaders. Note that
     * `name` is used in a 'LIKE' expression and therefore can contain
     * metacharacters like '%'.
     */
    private async headers(name: string): Promise<TableHeader[]> {
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
                .where('TABLE_SCHEMA = ?', this.helper.databaseName())
                .where('TABLE_NAME LIKE ?', name)
                .order('ORDINAL_POSITION');
        });

        // Map each BinaryRow into a TableHeader, removing any additional rows
        // that share the same name
        return _.map(result, (row: any): TableHeader => {
            const rawType = row.COLUMN_TYPE as string;
            const type = TableDao.parseType(rawType);
            const isNumerical = type === 'integer' || type === 'float';
            const defaultValue = TableDao.identifyDefaultValue(rawType, type, row.COLUMN_DEFAULT);

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
                enumValues: TableDao.findEnumValues(row.COLUMN_TYPE as string),
                comment: row.COLUMN_COMMENT as string,
                tableName: row.TABLE_NAME as string
            };
        });
    }

    private prepareForInsert(headers: TableHeader[],
                             partTableHeaders: PartTableHeaders,
                             row: SqlRow): PreparedInsert {

        const masterTableName = headers[0].tableName;
        const prep: PreparedInsert = {};
        prep[masterTableName] = [this.prepareRow(headers, row)];

        // Since `typeof null === 'object'`
        if (row.$parts !== null && typeof row.$parts === 'object') {
            // row.$parts is an object whose keys are the clean name of the
            // table and whose values is an array of objects that fit the schema
            // for the table
            for (const partCleanName of Object.keys(row.$parts)) {
                const partHeaders = partTableHeaders[partCleanName];
                if (partHeaders === undefined)
                    throw new Error(`expected headers for part table "${partCleanName}"`);
                const sqlName = partHeaders[0].tableName;

                const partRows = row.$parts[partCleanName];

                const prepared = _.map(partRows, (r) => this.prepareRow(partHeaders, r));
                if (prepared.length !== 0)
                    prep[sqlName] = prepared;
            }
        }

        return prep;
    }

    private prepareRow(headers: TableHeader[], row: SqlRow): PreparedRow {
        const prepped: PreparedRow = {};
        const headerNames: string[] = _.map(headers, 'name');

        for (const column of Object.keys(row)) {
            // $parts is a special property, ignore it
            if (column === '$parts') continue;

            if (headerNames.indexOf(column) < 0)
                throw new Error('unknown column: ' + column);

            const header = _.find(headers, (h) => h.name === column);
            if (header === undefined)
                throw new Error('could not find header for column: ' + column);

            // Make sure to escape the column name here
            prepped[this.helper.escapeId(header.name)] = this.prepareCell(header, row[column]);
        }
        return prepped;
    }

    private prepareCell(header: TableHeader, value: any): PreparedCell {
        if (header.type === 'datetime') {
            return this.helper.plainString('STR_TO_DATE(?, ?)', value, '%Y-%m-%d %H:%i:%s');
        } else if (header.type === 'date') {
            return this.helper.plainString('STR_TO_DATE(?, ?)', value, '%Y-%m-%d');
        } else if (header.rawType === 'tinyint(1)') {
            // We can't return a boolean here since apparently MySQL doesn't like
            // that. Instead, treat true/false values like we would a SQL
            // function
            return this.helper.plainString(value === true ? 'TRUE' : 'FALSE');
        } else if (header.numericScale && header.numericScale === 0) {
            return parseInt(value, 10);
        } else if (header.isNumerical) {
            return parseFloat(value);
        } else if (header.isTextual) {
            return value === null ? null : value.toString();
        }

        throw new Error(`Could not prepare value with type of ${header.type} ` +
            `(${header.tableName}: ${header.name}`);
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
        if (rawType.includes('char')) return 'string';
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
