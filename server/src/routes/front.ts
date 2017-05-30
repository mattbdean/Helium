import { Request, Response, Router } from 'express';
import * as path from 'path';

export function front(): Router {
    const r = Router();

    r.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, '../public/index.html'), (err: Error) => {
            if (err) {
                return res.status(500)
                    .contentType('text/plain')
                    .send('This website didn\'t go through its build process properly');
            }
        });
    });

    return r;
}
