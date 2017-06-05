import { Request, Response, Router } from 'express';
import * as _ from 'lodash';

import { ErrorResponse, SqlTableHeader } from '../../../common/responses';
import { Database } from '../../../Database';
import { NODE_ENV, NodeEnv } from '../../../env';
import { RouteModule } from '../../RouteModule';

export function tables(): RouteModule {
    const r = Router();

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

    r.get('/:name/meta', async (req: Request, res: Response) => {
        try {
            const headers = await fetchTableHeaders(req.params.name);
            if (headers.length === 0) {
                return sendRequestError(res, 404, {
                    message: `Couldn't find table`,
                    input: { name: req.params.name }
                });
            }

            res.json(headers);
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {
                    name: req.params.name
                }
            });
        }
    });

    const internalError = (res: Response, err: Error, data: ErrorResponse) => {
        const responseData = data as any;
        if (NODE_ENV !== NodeEnv.PROD)
            responseData.error = {
                name: err.name,
                message: err.message,
                stack: err.stack ? err.stack.split('\n') : null
            };
        res.status(500).json(data);
    };

    const sendRequestError = (res: Response, code: number, data: ErrorResponse) => {
        res.status(code).json(data);
    };

    return {
        router: r,
        mountPoint: '/tables'
    };
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

export async function fetchTableHeaders(tableName: string): Promise<SqlTableHeader[]> {
    const result = (await Database.get().conn.execute(
        `SELECT
            COLUMN_NAME, ORDINAL_POSITION, IS_NULLABLE, DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_SCALE, NUMERIC_PRECISION,
            CHARACTER_SET_NAME, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.columns
        WHERE TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION ASC`,
        [tableName]
    ))[0]; // first element is content, second element is metadata

    // Map each BinaryRow into a SqlTableHeader, removing any additional rows
    // that share the same name
    return _.uniqBy(_.map(result, (row: any): SqlTableHeader => ({
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
        isTextual: isTextualType(row.DATA_TYPE as string)
    })), 'name');

}

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
