import { NextFunction, Request, Response, Router } from 'express';
import * as paginate from 'express-paginate';
import * as joi from 'joi';
import { merge, pick } from 'lodash';
import { Filter } from '../../../common/api';
import {
    ErrorResponse,
    PaginatedResponse
} from '../../../common/responses';
import { DatabaseHelper } from '../../../db/database.helper';
import { debug, NODE_ENV, NodeEnv } from '../../../env';
import { DaoFactory } from '../dao.factory';
import { ErrorCode } from '../error-code.enum';
import { ValidationError } from '../validation-error';
import { SchemaDao, Sort } from './schema.dao';

export function schemasRouter(db: DatabaseHelper, daoFactory: DaoFactory): Router {
    const r = Router();

    const filtersSchema = joi.array().items(
        joi.object({
            op: joi.string(),
            param: joi.string(),
            value: joi.string()
        }).requiredKeys('op', 'param', 'value')
    );

    /**
     * Routing callback "middleware" that only passes control to the next
     * callback if the request has an active session and that session has a
     * database associated with it
     */
    const requireActiveSession = (req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.header('x-api-key');
        if (apiKey === undefined) {
            // Require an active session
            const resp: ErrorResponse = {
                message: 'Please specify an X-API-Key header with your API key from POST /api/v1/login',
                input: {}
            };
            return res.status(401).json(resp);
        }

        if (!db.hasPool(apiKey)) {
            const resp: ErrorResponse = {
                message: 'No database connection associated with this session',
                input: {}
            };
            return res.status(401).json(resp);
        } else {
            // All good, set expiration header
            res.header('X-Session-Expiration', String(db.expiration(apiKey)));
            next();
        }
    };

    // All endpoints defined here must have an active session
    r.use(requireActiveSession);

    const daoFor = (req: Request): SchemaDao => daoFactory(db, req.header('x-api-key')!!);

    // Limit 25 records by default, allowing a maximum of 100
    r.use(paginate.middleware(25, 100));

    r.get('/', async (req: Request, res: Response) => {
        try {
            res.json(await daoFor(req).schemas());
        } catch (err) {
            internalError(res, err, {
                message: 'Could not execute request',
                input: {}
            });
        }
    });

    r.get('/:schema', async (req: Request, res: Response) => {
        try {
            res.json(await daoFor(req).tables(req.params.schema));
        } catch (err) {
            if (err.code === 'ER_DBACCESS_DENIED_ERROR') {
                return sendError(res, 404, {
                    message: 'Cannot access schema',
                    input: { schema: req.params.schema } });
            } else {
                internalError(res, err, {
                    message: 'Could not execute request',
                    input: {}
                });
            }
        }
    });

    r.get('/:schema/:table/data', async (req: Request, res: Response) => {
        const schema: string = req.params.schema;
        const name: string = req.params.table;

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
        const input = merge(
            pick(req.params, ['schema', 'table']),
            pick(req.query, ['sort', 'limit', 'page', 'filters'])
        );

        // Try to parse the filters as JSON
        let filtersInput: any[];
        try {
            filtersInput = req.query.filters ? JSON.parse(req.query.filters) : [];
        } catch (err) {
            return sendError(res, 400, { message: 'filters param has malformed JSON', input });
        }

        const result = filtersSchema.validate(filtersInput);

        if (result.error) {
            return sendError(res, 400, { message: 'filters param is invalid', input });
        }

        const filters: Filter[] = result.value;

        try {
            const data = await daoFor(req).content(schema, name, {
                page: req.query.page,
                limit: req.query.limit,
                sort
            }, filters);

            const response: PaginatedResponse<any> = {
                size: data.length,
                data
            };
            res.json(response);
        } catch (err) {

            if (err.code) {
                if (err.code === 'ER_DBACCESS_DENIED_ERROR')
                    return sendError(res, 404, { message: 'database not found', input });
                else if (err.code === 'ER_NO_SUCH_TABLE')
                    return sendError(res, 404, { message: 'no such table', input });
                else if (err.code === 'ER_BAD_FIELD_ERROR')
                    return sendError(res, 400, {
                        message: 'Cannot sort: no such column name',
                        input
                    });
            }

            internalError(res, err, {
                message: 'Could not execute request',
                input
            });
        }
    });

    r.get('/:schema/:table', async (req: Request, res: Response) => {
        const schema = req.params.schema;
        const table = req.params.table;

        try {
            res.json(await daoFor(req).meta(schema, table));
        } catch (e) {
            const input = pick(req.params, ['schema', 'table']);
            if (e.code && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_DBACCESS_DENIED_ERROR'))
                return sendError(res, 404, {
                    message: 'No such table',
                    input
                });
            return internalError(res, e, {
                message: 'Unable to execute request',
                input
            });
        }
    });

    r.put('/:schema/data', async (req, res) => {
        const schema: string = req.params.schema;

        const send400 = (message: string) =>
            sendError(res, 400, { message, input: {
                schema,
                data: req.body
            }});

        try {
            await daoFor(req).insertRow(schema, req.body);
            res.status(200).send({});
        } catch (e) {
            // TODO never write anything this ugly again
            if (e instanceof ValidationError) {
                switch (e.code) {
                    case ErrorCode.NO_SUCH_TABLE:
                        return sendError(res, 404, {
                            message: 'that table doesn\'t exist',
                            input: { data: req.body }
                        });
                    default:
                        return sendError(res, 400, {
                            message: e.message,
                            input: { data: req.body }
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
                            data: req.body
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
                    schema: req.params.schema,
                    data: req.body
                }
            });
        }
    });

    r.get('/:schema/:table/column/:col', async (req, res) => {
        try {
            res.json(await daoFor(req).columnContent(req.params.schema, req.params.table, req.params.col));
        } catch (e) {
            const input = pick(req.params, ['schema', 'table', 'col']);

            // Try to handle any errors thrown while fetching the data
            if (e.code) {
                switch (e.code) {
                    case 'ER_BAD_FIELD_ERROR':
                        return sendError(res, 404, {
                            message: 'no such column',
                            input
                        });
                    case 'ER_NO_SUCH_TABLE':
                        return sendError(res, 404, {
                            message: 'no such table',
                            input
                        });
                    case 'ER_DBACCESS_DENIED_ERROR':
                        return sendError(res, 404, {
                            message: 'no such schema',
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

    return r;
}
