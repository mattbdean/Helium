
import { ErrorCode } from './error-code';

export class ValidationError extends Error {
    constructor(msg: string, public readonly code: ErrorCode, public readonly relevantInput?: any) {
        super(msg);

        // https://stackoverflow.com/a/41102306
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
