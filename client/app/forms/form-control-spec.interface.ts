import { ValidatorFn } from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { DefaultValue } from '../common/api';

export type FormControlType = 'text' | 'enum' | 'boolean' | 'date' | 'autocomplete';

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

    /** A value to prepopulate the form control with */
    defaultValue?: DefaultValue;

    /** More specific input type. Not always used. */
    subtype?: string;

    /** Simple validation functions, such as `Validators.required` */
    validation?: ValidatorFn[];

    /** A list of possible enumerated values. Only used when `type` is 'enum'. */
    enumValues?: string[];

    required: boolean;

    /** If true, the form control will be disabled */
    disabled?: boolean;

    autocompleteValues?: Observable<string[]>;
}
