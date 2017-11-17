import { Request, Response, Router } from 'express';
import * as paginate from 'express-paginate';
import {
    ErrorResponse,
    PaginatedResponse
} from '../../common/responses';
import { Database } from '../../db/database.helper';
import { debug, NODE_ENV, NodeEnv } from '../../env';
import { ErrorCode } from './error-code.enum';
import { Sort, TableDao } from './tables.queries';
import { ValidationError } from './validation-error';

const TABLE_NAME_REGEX = /^[A-Za-z0-9_#~]*$/;

export function tables(db: Database): Router {
    const r = Router();
    const dao = new TableDao(db);
    r.use(paginate.middleware(25, 100));

    r.get('/', async (req: Request, res: Response) => {
        try {
            res.json(await dao.list());
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {}
            });
        }
    });

    r.get('/:name/data', async (req: Request, res: Response) => {
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
            const data = await dao.content(name, req.query.page, req.query.limit, sort);
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

    r.get('/:name', async (req: Request, res: Response) => {
        try {
            const name = req.params.name;
            if (!verifyTableName(name, res)) return;

            try {
                res.json(await dao.meta(name));
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
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {
                    name: req.params.name
                }
            });
        }
    });

    r.put('/:name/data', async (req, res) => {
        const table: string = req.params.name;
        if (!verifyTableName(table, res)) return;

        const send400 = (message: string) =>
            sendError(res, 400, { message, input: {
                name: table,
                data: req.body
            }});

        if (table.indexOf('__') > 0)
            return send400('inserting data into part tables directly is forbidden');

        try {
            await dao.insertRow(table, req.body);
            res.status(200).send({});
        } catch (e) {
            // TODO never write anything this ugly again
            if (e instanceof ValidationError) {
                switch (e.code) {
                    case ErrorCode.NO_SUCH_TABLE:
                        return sendError(res, 404, {
                            message: 'that table doesn\'t exist',
                            input: {
                                name: table,
                                data: req.body
                            }
                        });
                    default:
                        return sendError(res, 400, {
                            message: e.message,
                            input: {
                                name: table,
                                data: req.body
                            }
                        });
                }
            }

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
                            table
                        });
                        break;
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

            // Handle any validation errors
            if (e.isJoi) {
                // e.details is an array of all validation errors, pick out the
                // first one to send to the user
                return send400(e.details[0].message);
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
            res.json(await dao.columnContent(req.params.name, req.params.col));
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
                message: 'table name must be entirely alphanumeric and optionally ' +
                    'prefixed with "~" or "#"',
                input: { name }
            });
            return false;
        }
        return true;
    };

    return r;
}
