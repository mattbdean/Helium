import * as _ from 'lodash';

import {
    Constraint, ConstraintType, SqlRow,
    TableHeader, TableMeta
} from '../../common/responses';
import { Database, squel } from '../../Database';

/**
 * Simple interface for describing the way some data is to be organized
 */
export interface Sort {
    direction: 'asc' | 'desc';
    /** Name of the column to sort by */
    by: string;
}

interface PreparedCell {
    key: any;
    value: any;
    dontQuote: boolean;
}

export class TableDao {
    /**
     * Returns an array of all available table names
     */
    public static async list(): Promise<string[]> {
        const db = Database.get();
        // db.conn is a PromiseConnection that wraps a Connection. A
        // Connection has a property `config`
        const dbName = db.conn.connection.config.database;
        const result = await db.conn.execute(
            'SELECT table_name FROM INFORMATION_SCHEMA.tables WHERE TABLE_SCHEMA = ?',
            [dbName]
        );

        /*
        Transform this:
        [
            { table_name: 'foo' },
            { table_name: 'bar' },
            { table_name: 'baz' },
        ]

        Into this:
        ['foo', 'bar', 'baz']
         */
        return _.map(result[0], 'table_name');
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
    public static async content(name: string,
                                page: number = 1,
                                limit: number = 25,
                                sort: Sort | undefined): Promise<SqlRow[]> {

        const conn = Database.get().conn;
        const escapedName = conn.escapeId(name);

        // Create our basic query
        let query = squel
            .select()
            // Make sure we escape the table name so that we're less vulnerable to
            // SQL injection
            .from(escapedName)
            // Pagination
            .limit(limit)
            .offset((page - 1) * limit);

        if (sort !== undefined) {
            // Specify a sort if provided
            query = query.order(conn.escapeId(sort.by), sort.direction === 'asc');
        }

        return (await (Database.get().conn.execute(query.toString())))[0];
    }

    /**
     * Fetches a TableMeta instance for the given table.
     */
    public static async meta(name: string): Promise<TableMeta> {
        const [headers, count, constraints, comment] = await Promise.all([
            TableDao.headers(name),
            TableDao.count(name),
            TableDao.constraints(name).then((constrs) => TableDao.resolveConstraints(constrs)),
            TableDao.comment(name)
        ]);

        return {
            headers,
            totalRows: count,
            constraints,
            comment
        };
    }

    /**
     * Fetches all distinct values from one column. Useful for autocomplete.
     */
    public static async columnContent(table: string, column: string): Promise<Array<string | number>> {
        const conn = Database.get().conn;

        // SELECT DISTINCT $col FROM $table ORDER BY $col ASC
        const query = squel
            .select()
            .distinct()
            .from(conn.escapeId(table))
            .field(conn.escapeId(column))
            .order(conn.escapeId(column));

        const result = await conn.execute(query.toString());
        // Each row is a document mapping the column to its value. In this case, we
        // only have one item in the row, flatten the array of objects into an array
        // of each value
        return _.map(result[0], (row) => row[column]);
    }

    /**
     * Inserts a row into a given table. The given data will be verified before
     * inserting.
     */
    public static async insertRow(table: string, data: SqlRow) {
        const preparedData: PreparedCell[] = await TableDao.prepareForInsert(table, data);
        const conn = Database.get().conn;

        // Create base 'INSERT INTO' query
        const query = squel.insert().into(conn.escapeId(table));

        // Set key/value pairs to insert
        for (const cell of preparedData) {
            query.set(conn.escapeId(cell.key), cell.value, {
                dontQuote: cell.dontQuote
            });
        }

        // Execute the query
        await conn.execute(query.toString());
    }

    /**
     * Gets a list of constraints on a given table. Currently, only primary keys,
     * foreign keys, and unique constraints are recognized.
     */
    private static async constraints(name: string): Promise<Constraint[]> {
        const result = (await Database.get().conn.execute(
            `SELECT
                COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION ASC`,
            [Database.get().dbName(), name]
        ))[0]; // first element is content, second element is metadata

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
    private static async resolveConstraints(originals: Constraint[]): Promise<Constraint[]> {
        // Keep tables in cache once we look them up to prevent any unnecessary
        // lookups
        const cache: { [tableName: string]: Constraint[] } = {};

        // Return constraints from cache, otherwise look them up
        const getConstraints = (name: string): Promise<Constraint[]> => {
            return cache[name] ? Promise.resolve(cache[name]) : TableDao.constraints(name);
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
    private static async comment(name: string): Promise<string> {
        const conn = Database.get().conn;
        const query = squel.select()
            .from('INFORMATION_SCHEMA.TABLES')
            .field('TABLE_COMMENT')
            .where('TABLE_NAME = ' + conn.escape(name))
            .where('TABLE_SCHEMA = ' + conn.escape(Database.get().dbName()));

        const result = (await conn.execute(query.toString()))[0];
        return result[0].TABLE_COMMENT;
    }

    /** Counts the amount of rows in a table */
    private static async count(name: string): Promise<number> {
        const conn = Database.get().conn;
        const result = (await conn.execute(
            // This query can apparently be slow for a table with billions of rows,
            // but let's cross that bridge when we get to it
            `SELECT COUNT(*) FROM ${conn.escapeId(name)}`
        ))[0];
        // This query returns only one row
        return result[0]['COUNT(*)'];
    }

    /** Returns a Promise the resolves to an array of TableHeaders */
    private static async headers(name: string): Promise<TableHeader[]> {
        const result = (await Database.get().conn.execute(
            `SELECT
                COLUMN_NAME, ORDINAL_POSITION, IS_NULLABLE, DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH, NUMERIC_SCALE, NUMERIC_PRECISION,
                CHARACTER_SET_NAME, COLUMN_TYPE, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.columns
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION ASC`,
            [Database.get().dbName(), name]
        ))[0]; // first element is content, second element is metadata

        // Map each BinaryRow into a TableHeader, removing any additional rows
        // that share the same name
        return _.map(result, (row: any): TableHeader => ({
            name: row.COLUMN_NAME as string,
            type: row.DATA_TYPE as string,
            ordinalPosition: row.ORDINAL_POSITION as number,
            rawType: row.COLUMN_TYPE as string,
            nullable: row.IS_NULLABLE === 'YES',
            maxCharacters: row.CHARACTER_MAXIMUM_LENGTH as number,
            charset: row.CHARACTER_SET_NAME as string,
            numericPrecision: row.NUMERIC_PRECISION as number,
            numericScale: row.NUMERIC_SCALE as number,
            enumValues: TableDao.findEnumValues(row.COLUMN_TYPE as string),
            isNumber: TableDao.isNumericalType(row.DATA_TYPE as string),
            isTextual: !TableDao.isNumericalType(row.DATA_TYPE as string),
            comment: row.COLUMN_COMMENT as string
        }));
    }

    private static async prepareForInsert(table: string, row: SqlRow): Promise<PreparedCell[]> {
        const headers: TableHeader[] = await TableDao.headers(table);
        const newRow: PreparedCell[] = [];

        const headerNames: string[] = _.map(headers, 'name');

        for (const column of Object.keys(row)) {
            if (headerNames.indexOf(column) < 0)
                throw new Error('unknown column: ' + column);

            const header = _.find(headers, (h) => h.name === column);
            if (header === undefined)
                throw new Error('could not find header for column: ' + column);
            newRow.push(TableDao.prepareCell(header, row[column]));
        }

        return newRow;
    }

    private static prepareCell(header: TableHeader, value: any): PreparedCell {
        const quoted = (val: any): PreparedCell => ({
            key: header.name,
            value: val,
            dontQuote: false
        });

        if (header.type === 'date' || header.type === 'timestamp') {
            return {
                key: header.name,
                value: `FROM_UNIXTIME(${new Date(value).getTime() / 1000})`,
                dontQuote: true
            };
        } else if (header.rawType === 'tinyint(1)')
            return quoted(value === true || value === 'true' || value === 1);
        else if (header.numericScale && header.numericScale === 0)
            return quoted(parseInt(value, 10));
        else if (header.isNumber)
            return quoted(parseFloat(value));
        else
            return quoted(value);
    }

    private static isNumericalType(type: string): boolean {
        return /int/.test(type) || type === 'decimal' || type === 'double';
    }

    private static findEnumValues(raw: string): string[] | null {
        if (!/^enum\(/.test(raw)) return null;
        const matches = raw.match(/^enum\('(.*)'\)$/);
        if (matches === null || matches.length !== 2)
            throw new Error(`Expecting a match from input string ${raw}`);
        return matches[1].split("','");
    }

}
