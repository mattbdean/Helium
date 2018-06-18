import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Validates a given string to be parsed as a page index. Returns an integer if
 * successful or null if unsuccessful. 
 */
export function validateInteger(userInput: string): number | null {
    if (!/^[0-9]+$/.test(String(userInput).trim()))
        return null;

    return Number(userInput);
}

/**
 * A function that creates an async validator that reports an error whenever the
 * input is not a valid index input. A valid index input must be:
 * 
 *  1. A string strictly comprised of digits 0-9 (no decimals allowed)
 *  2. At least 0 and at most the last-emitted value of maxIndex$
 */
export function pageIndexValidator(maxIndex$: Observable<number>): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
        return combineLatest(control.valueChanges, maxIndex$).pipe(
            map(([userInput, maxIndex]) => {
                const index = validateInteger(userInput);
                if (index === null)
                    return { pageIndex: 'not an integer' };

                if (index < 0 || index > maxIndex)
                    return { pageIndex: 'index < 0 || index > ' + maxIndex };

                return null;
            })
        );
    };
}
