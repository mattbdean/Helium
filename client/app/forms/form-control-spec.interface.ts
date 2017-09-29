import { ValidatorFn } from '@angular/forms';

export type FormControlType = 'text' | 'enum' | 'boolean';
export type FormControlSubtype = 'text' | 'number';

/**
 * Defines how a specific form control should behave.
 */
export interface FormControlSpec {
    type: FormControlType;

    /**
     * The name of the form control such that the AbstractControl for this form
     * element can be accessed through `group.get(formControlName)`.
     */
    formControlName: string;

    /** A value to present to the user when the current value is empty */
    placeholder: string;

    /** More specific input type. Only used when `type` is 'text'. */
    subtype?: FormControlSubtype;

    /** Simple validation functions, such as `Validators.required` */
    validation?: ValidatorFn[];

    /** A list of possible enumerated values. Only used when `type` is 'enum'. */
    enumValues?: string[];

    initialValue?: any;

    required: boolean;
}
