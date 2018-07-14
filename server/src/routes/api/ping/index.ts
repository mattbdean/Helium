import { Router } from 'express';
import { ErrorResponse } from '../../../common/api';
import { SessionPing } from '../../../common/api';
import { DatabaseHelper } from '../../../db/database.helper';

export function pingRouter(db: DatabaseHelper) {
    const r = Router();

    r.get('/', (req, res) => {
        const apiKey = req.header('x-api-key');
        if (apiKey === undefined) {
            const err: ErrorResponse = {
                message: 'X-API-Key header not present in request'
            };
            return res.status(400).json(err);
        }

        const isValid = db.hasPool(apiKey);
        const expiration = isValid ? db.expiration(apiKey) : null;

        const json: SessionPing = {
            validApiKey: isValid,
            expiresAt: expiration
        };

        // For the sake of consistency
        res.header('X-Session-Expiration', String(db.expiration(apiKey)));

        res.json(json);
    });

    return r;
}
