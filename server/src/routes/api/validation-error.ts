
import { ErrorCode } from './error-code.enum';

export class ValidationError extends Error {
    constructor(msg: string, public readonly code: ErrorCode) {
        super(msg);

        // https://stackoverflow.com/a/41102306
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
