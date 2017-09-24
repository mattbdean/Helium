import { ValidatorFn } from '@angular/forms';

/**
 * Defines how a specific form control should behave.
 */
export interface FormControlSpec {
    /**
     * The name of the form control such that the AbstractControl for this form
     * element can be accessed through `group.get(formControlName)`.
     */
    formControlName: string;

    /** A value to present to the user when the current value is empty */
    placeholder: string;

    /** Simple validation functions, such as `Validation.required` */
    validation?: ValidatorFn[];
}
