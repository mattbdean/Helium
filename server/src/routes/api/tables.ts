import * as paginate from 'express-paginate';
import * as _ from 'lodash';

import { Request, Response, Router } from 'express';
import {
    Constraint,
    ConstraintType,
    ErrorResponse,
    PaginatedResponse,
    SqlRow,
    TableHeader,
    TableMeta,
} from '../../common/responses';
import { Database, squel } from '../../Database';
import { debug, NODE_ENV, NodeEnv } from '../../env';

const TABLE_NAME_REGEX = /^[#~]?[a-zA-Z]+$/;

export function tables(): Router {
    const r = Router();
    r.use(paginate.middleware(25, 100));

    r.get('/', async (req: Request, res: Response) => {
        try {
            res.json(await fetchTableNames());
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {}
            });
        }
    });

    r.get('/:name', async (req: Request, res: Response) => {
        const name: string = req.params.name;

        if (!verifyTableName(name, res)) return;

        let sort: Sort | undefined;
        if (req.query.sort) {
            let sortStr: string = req.query.sort.trim();
            let dir: 'asc' | 'desc' = 'asc';
            if (sortStr.indexOf('-') === 0) {
                dir = 'desc';
                sortStr = sortStr.slice(1);
            }

            sort = { by: sortStr, direction: dir };
        }

        try {
            const data = await fetchTableContent(name, req.query.page, req.query.limit, sort);
            const response: PaginatedResponse<any> = {
                size: data.length,
                data
            };
            res.json(response);
        } catch (err) {
            if (err.code && err.code === "ER_BAD_FIELD_ERROR")
                return sendError(res, 400, {
                    message: 'Cannot sort: no such column name',
                    input: { sort: req.query.sort }
                });

            internalError(res, err, {
                message: 'Could not execute request',
                input: { name: req.params.name }
            });
        }
    });

    r.get('/:name/meta', async (req: Request, res: Response) => {
        try {
            const name = req.params.name;
            if (!verifyTableName(name, res)) return;

            let headers: TableHeader[] = [],
                count: number = -1,
                constraints: Constraint[] = [],
                comment: string;
            
            try {
                [headers, count, constraints, comment] = await Promise.all([
                    fetchTableHeaders(name),
                    fetchTableCount(name),
                    fetchConstraints(name).then((constrs) => resolveConstraints(name, constrs)),
                    fetchTableComment(name)
                ]);
            } catch (e) {
                if (e.code && e.code === 'ER_NO_SUCH_TABLE')
                    return sendError(res, 404, {
                        message: 'No such table',
                        input: { name }
                    });
                return internalError(res, e, {
                    message: 'Unable to execute request',
                    input: { name }
                });
            }

            const response: TableMeta = {
                headers,
                totalRows: count,
                constraints,
                comment
            };

            res.json(response);
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {
                    name: req.params.name
                }
            });
        }
    });

    r.put('/:name', async (req, res) => {
        if (!verifyTableName(req.params.name, res)) return;

        try {
            await insertRow(req.params.name, req.body);
            res.status(200).send({});
        } catch (e) {
            const send400 = (message: string) =>
                sendError(res, 400, { message, input: {
                    name: req.params.name,
                    data: req.body
                }});

            if (e.code) {
                switch (e.code) {
                    case 'ER_BAD_FIELD_ERROR':
                        return send400('no such column');
                    case 'ER_NO_SUCH_TABLE':
                        return send400('no such table');
                    case 'ER_DUP_ENTRY':
                        return send400('duplicate entry');
                    case 'ER_TRUNCATED_WRONG_VALUE':
                        // No good way to directly pinpoint the cause, send the
                        // message directly
                        return send400(e.message);
                    case 'ER_PARSE_ERROR':
                        // Log the message and continue so that we eventually
                        // send an internal server error
                        debug({
                            message: 'generated invalid SQL',
                            data: req.body,
                            table: req.params.name
                        });
                    case 'ER_DATA_TOO_LONG':
                        // No way to get the actual column that caused the error
                        // short of regexps, just send back the error
                        return send400(e.message);
                    case 'ER_NO_REFERENCED_ROW_2':
                        // The default message may reveal too much but that's
                        // okay for right now
                        return send400(e.message);
                }
            }

            return internalError(res, e, {
                message: 'Could not execute request',
                input: {
                    name: req.params.name,
                    data: req.body
                }
            });
        }
    });

    r.get('/:name/column/:col', async (req, res) => {
        if (!verifyTableName(req.params.name, res)) return;

        try {
            res.json(await fetchDistinctValues(req.params.name, req.params.col));
        } catch (e) {
            const input = {
                name: req.params.name,
                col: req.params.col
            };

            // Try to handle any errors thrown while fetching the data
            if (e.code) {
                switch (e.code) {
                    case 'ER_BAD_FIELD_ERROR':
                        return sendError(res, 400, {
                            message: 'no such column',
                            input
                        });
                    case 'ER_NO_SUCH_TABLE':
                        return sendError(res, 400, {
                            message: 'no such table',
                            input
                        });
                }
            }

            // Unknown error, fall back to 500 Internal Server Error
            return internalError(res, e, {
                message: 'Could not execute request',
                input
            });
        }
    });

    const internalError = (res: Response, err: Error, data: ErrorResponse) => {
        debug(err);
        const responseData = data as any;
        if (NODE_ENV !== NodeEnv.PROD)
            responseData.error = {
                name: err.name,
                message: err.message,
                stack: err.stack ? err.stack.split('\n') : null
            };
        res.status(500).json(data);
    };

    const sendError = (res: Response, code: number, data: ErrorResponse) => {
        res.status(code).json(data);
    };

    /**
     * Verifies that a given table name is valid. If the table is determined to
     * be invalid, a 400 response will be sent and this function will return
     * false.
     */
    const verifyTableName = (name: string, res: Response): boolean => {
        if (!TABLE_NAME_REGEX.test(name)) {
            sendError(res, 400, {
                message: 'table name must be entirely alphabetic and optionally ' +
                    'prefixed with "~" or "#"',
                input: { name }
            });
            return false;
        }
        return true;
    };

    const sendRequestError = (res: Response, code: number, data: ErrorResponse) => {
        res.status(code).json(data);
    };

    return r;
}

export async function fetchTableNames(): Promise<string[]> {
    const db = Database.get();
    // db.conn is a PromiseConnection that wraps a Connection. A
    // Connection has a property `config`
    const dbName = db.conn.connection.config.database;
    const result = await db.conn.execute(
        'SELECT table_name FROM INFORMATION_SCHEMA.tables WHERE TABLE_SCHEMA = ?',
        [dbName]
    );

    // Simplify the return structure to an array of strings
    return _.map(result[0], (row: { table_name: string }) => row.table_name);
}

export async function fetchTableHeaders(tableName: string): Promise<TableHeader[]> {
    const result = (await Database.get().conn.execute(
        `SELECT
            COLUMN_NAME, ORDINAL_POSITION, IS_NULLABLE, DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_SCALE, NUMERIC_PRECISION,
            CHARACTER_SET_NAME, COLUMN_TYPE, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.columns
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION ASC`,
        [Database.get().dbName(), tableName]
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
        enumValues: findEnumValues(row.COLUMN_TYPE as string),
        isNumber: isNumberType(row.DATA_TYPE as string),
        isTextual: isTextualType(row.DATA_TYPE as string),
        comment: row.COLUMN_COMMENT as string
    }));
}

export async function fetchTableCount(tableName: string): Promise<number> {
    const conn = Database.get().conn;
    const result = (await conn.execute(
        // This query can apparently be slow for a table with billions of rows,
        // but let's cross that bridge when we get to it
        `SELECT COUNT(*) FROM ${conn.escapeId(tableName)}`
    ))[0];
    // This query returns only one row
    return result[0]['COUNT(*)'];
}

interface Sort {
    direction: 'asc' | 'desc';
    by: string;
}

export async function fetchTableContent(tableName: string, page: number, limit: number, sort?: Sort): Promise<SqlRow> {
    const conn = Database.get().conn;
    const escapedName = conn.escapeId(tableName);

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
 * Gets a list of constraints on a given table. Currently, only primary keys,
 * foreign keys, and unique constraints are recognized.
 */
export async function fetchConstraints(table: string): Promise<Constraint[]> {
    const result = (await Database.get().conn.execute(
        `SELECT
            COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION ASC`,
        [Database.get().dbName(), table]
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

export async function fetchTableComment(table: string): Promise<string> {
    const conn = Database.get().conn;
    const query = squel.select()
        .from('INFORMATION_SCHEMA.TABLES')
        .field('TABLE_COMMENT')
        .where('TABLE_NAME = ' + conn.escape(table))
        .where('TABLE_SCHEMA = ' + conn.escape(Database.get().dbName()));
    
    const result = (await conn.execute(query.toString()))[0];
    return result[0].TABLE_COMMENT;
}

export async function resolveConstraints(table: string, originals: Constraint[]): Promise<Constraint[]> {
    // Keep tables in cache once we look them up to prevent any unnecessary
    // lookups
    const cache: { [tableName: string]: Constraint[] } = {};

    // Return constraints from cache, otherwise look them up
    const getConstraints = (name: string): Promise<Constraint[]> => {
        return cache[name] ? Promise.resolve(cache[name]) : fetchConstraints(name);
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

        let current: Constraint = findConstraint(c.localColumn, originals);
        let previous: Constraint | undefined;
        const originalLocalColumn = current.localColumn;

        // Navigate up the hierarchy until we find a non-FK constraint. 
        // TODO: this algorithm will fail if the original column is NOT a
        // constraint
        while (current.foreignTable !== null) {
            previous = current;
            current = findConstraint(current.foreignColumn!!, await getConstraints(current.foreignTable));
        }

        if (previous !== undefined)
            resolved.push(previous);
    }

    return resolved;
}

export async function fetchDistinctValues(table: string, col: string): Promise<any[]> {
    const conn = Database.get().conn;

    // SELECT DISTINCT $col FROM $table ORDER BY $col ASC
    const query = squel
        .select()
        .distinct()
        .from(conn.escapeId(table))
        .field(conn.escapeId(col))
        .order(conn.escapeId(col));

    const result = await conn.execute(query.toString());
    // Each row is a document mapping the column to its value. In this case, we
    // only have one item in the row, flatten the array of objects into an array
    // of each value
    return _.map(result[0], (row) => row[col]);
}

export async function insertRow(table: string, data: SqlRow) {
    const preparedData: PreparedCell[] = await prepareForInsert(table, data);
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

interface PreparedCell {
    key: any;
    value: any;
    dontQuote: boolean;
}

const prepareForInsert = async (table: string, row: SqlRow): Promise<PreparedCell[]> => {
    const headers: TableHeader[] = await fetchTableHeaders(table);
    const newRow: PreparedCell[] = [];

    const headerNames: string[] = _.map(headers, 'name');

    for (const column of Object.keys(row)) {
        if (headerNames.indexOf(column) < 0)
            throw new Error('unknown column: ' + column);
        
        const header = _.find(headers, (h) => h.name === column);
        if (header === undefined)
            throw new Error('could not find header for column: ' + column);
        newRow.push(prepareCell(header, row[column]));
    }

    return newRow;
};

const prepareCell = (header: TableHeader, value: any): PreparedCell => {
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
};

const isNumberType = (type: string): boolean =>
    /int/.test(type) || type === 'decimal' || type === 'double';

const isTextualType = (type: string): boolean =>
    type === 'varchar' ||
        type === 'char' ||
        type === 'enum' ||
        /text$/.test(type);

const findEnumValues = (raw: string): string[] | null => {
    if (!/^enum\(/.test(raw)) return null;
    const matches = raw.match(/^enum\('(.*)'\)$/);
    if (matches === null || matches.length !== 2)
        throw new Error(`Expecting a match from input string ${raw}`);
    return matches[1].split("','");
};
