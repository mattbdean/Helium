import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export function pageIndexValidator(maxIndex$: Observable<number>): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
        return combineLatest(control.valueChanges, maxIndex$).pipe(map((data): ValidationErrors | null => {
            const [currentValue, maxIndex] = data;

            if (!/^[0-9]+$/.test(String(currentValue))) {
                return { pageIndex: 'not an integer' };
            }

            const currentIndex = parseInt(currentValue, 10) - 1;
            if (currentIndex < 0)
                return { pageIndex: '< 1' };

            if (currentIndex > maxIndex)
                return { pageIndex: '> maxIndex (' + maxIndex + ')' };

            return null;
        }));
    };
}
