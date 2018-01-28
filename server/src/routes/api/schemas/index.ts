import {
    NextFunction, Request, Response, Router
} from 'express';
import * as paginate from 'express-paginate';
import * as joi from 'joi';
import { ValidationError as JoiValidationError } from 'joi';
import { SqlRow } from '../../../../../client/app/common/api';
import { Filter } from '../../../common/api';
import {
    ErrorResponse,
    PaginatedResponse
} from '../../../common/responses';
import { DatabaseHelper } from '../../../db/database.helper';
import { debug, NODE_ENV, NodeEnv } from '../../../env';
import { DaoFactory } from '../dao.factory';
import { ValidationError } from '../validation-error';
import { SchemaDao, Sort } from './schema.dao';

export function schemasRouter(db: DatabaseHelper, daoFactory: DaoFactory): Router {
    const r = Router();

    /**
     * Wraps a standard Express route handler. If the handler successfully
     * resolves to a value, that value is sent to the response as JSON. If the
     * handler rejects, that error is passed to the next error handling
     * middleware.
     *
     * @returns A function that can be passed directly to a routing method such
     * as `get` or `post`.
     */
    const wrap = (handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
        return (req: Request, res: Response, next: NextFunction) => {
            handler(req, res, next)
                .then((data) => {
                    res.json(data);
                })
                .catch((err) => {
                    next(err);
                });
        };
    };

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
                message: 'Please specify an X-API-Key header with your API ' +
                    'key from POST /api/v1/login'
            };
            return res.status(401).json(resp);
        }

        if (!db.hasPool(apiKey)) {
            const resp: ErrorResponse = {
                message: 'No database connection associated with this session'
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

    r.get('/', wrap((req: Request) => daoFor(req).schemas()));
    r.get('/:schema', wrap((req: Request) =>
        daoFor(req).tables(req.params.schema)));

    r.get('/:schema/:table/data', wrap(async (req: Request) => {
        // Create a Sort object, if one is specified in the query
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

        // Try to parse the filters as JSON
        let filtersInput: any[];
        try {
            // TODO this might make us vulernable to DOS attacks involving large
            // JSON documents as input
            filtersInput = req.query.filters ? JSON.parse(req.query.filters) : [];
        } catch (err) {
            // Rethrow as a ValidationError so the router error handler picks it
            // up
            throw new ValidationError('filters param has malformed JSON', 'MALFORMED_JSON', req.query.filters);
        }

        // Make sure the filters have the right shape
        const result = filtersSchema.validate(filtersInput);

        if (result.error) {
            throw new ValidationError('filters param is invalid', 'INVALID_FILTER');
        }

        const filters: Filter[] = result.value;

        // We have everything we need, request the data
        return daoFor(req).content(req.params.schema, req.params.table, {
            page: req.query.page,
            limit: req.query.limit,
            sort
        }, filters)
            // Once we have the data, wrap it in a PaginatedResponse
            .then((data: SqlRow[]): PaginatedResponse<any> => ({ size: data.length, data }));
    }));

    r.get('/:schema/:table', wrap((req: Request) =>
        daoFor(req).meta(req.params.schema, req.params.table)));

    r.put('/:schema/data', wrap((req: Request) =>
        // Insert the data and return an empty JSON document
        daoFor(req).insertRow(req.params.schema, req.body).then(() => ({}))));

    r.get('/:schema/:table/column/:col', wrap((req) => daoFor(req).columnContent(
            req.params.schema,
            req.params.table,
            req.params.col
    )));

    // This is where all error handling for the router happens
    r.use((err, req, res, next) => {
        if (err.isJoi) {
            handleJoiError(res, err);
        } else if (err instanceof ValidationError) {
            // Known/expected errors
            handleValidationError(res, err);
        } else if (err.code) {
            // MySQL-related errors
            handleDatabaseError(req, res, err);
        } else {
            // Unknown/unexpected errors
            handleInternalError(res, err);
        }
    });

    const handleJoiError = (res: Response, err: JoiValidationError) => {
        // err.details is an array of all validation errors, pick out the
        // first one to send to the user
        res.status(400).json(createErrorResponse(err.details[0].message, err));
    };

    /**
     * Handles errors returned by the database. The common ones are specifically
     * checked for. Unknown error codes are handled as well.
     */
    const handleDatabaseError = (req: Request, res: Response, err: any) => {
        // Create a generic message
        let message = 'Unknown issue accessing the database' +
            (NODE_ENV !== NodeEnv.PROD ? ` (${err.code}: ${err.message})` : '');

        // 400 Bad Request will be used if this remains null
        let code: number | null = null;

        switch (err.code) {
            case 'ER_DBACCESS_DENIED_ERROR':
                message = 'Unable to access requested database or schema';
                code = 404;
                break;
            case 'ER_BAD_FIELD_ERROR':
                message = 'Tried to reference unknown column';
                break;
            case 'ER_NO_SUCH_TABLE':
                message = 'No such table';
                code = 404;
                break;
            case 'ER_DUP_ENTRY':
                message = 'Cannot insert duplicate entry';
                break;
            case 'ER_TRUNCATED_WRONG_VALUE':
                // No good way to directly pinpoint the cause, send the
                // message directly
                message = err.message;
                break;
            case 'ER_PARSE_ERROR':
                // We should never see this unless we've seriously messed up on
                // our side. This should be treated as an internal server error.
                debug({
                    message: 'generated invalid SQL',
                    data: req.body
                });
                return handleInternalError(res, err);
            case 'ER_DATA_TOO_LONG':
                // No way to get the actual column that caused the error
                // short of regexps, just send back the error
                message = err.message;
                break;
            case 'ER_NO_REFERENCED_ROW_2':
                message = err.message;
                // The default message may reveal too much but that's
                // okay for right now
                message = err.message;
                break;
        }

        // Set `code` to 400 if it hasn't been messed with
        if (code === null) {
            code = 400;
        }

        res.status(code).json(createErrorResponse(message, err));
    };

    /** Handles expected internal validation errors */
    const handleValidationError = (res: Response, err: ValidationError) => {
        res.status(400).json(createErrorResponse(err.message, err));
    };

    /** Handles unexpected internal errors */
    const handleInternalError = (res: Response, err: any) => {
        // Print to console when not in production
        debug(err);

        // Send 500 Internal Server Error
        res.status(500).json(createErrorResponse('Unable to execute request', err));
    };

    /**
     * Creates an ErrorResponse. Only assigns a value to the `error` if not in
     * production.
     */
    const createErrorResponse = (message: string, err: any): ErrorResponse => {
        // Generic JSON response
        const data: ErrorResponse = { message: 'Unable to execute request' };

        // Show error information when not in production
        if (NODE_ENV !== NodeEnv.PROD) {
            data.error = {
                name: err.name,
                message: err.message,
                stack: err.stack ? err.stack.split('\n') : null
            };
        }

        return data;
    };

    return r;
}
