import { ValidatorFn } from '@angular/forms';

export interface FieldConfig {
    /** Name of the field inside the FormGroup */
    name: string;

    /** Human-readable name for this field */
    label: string;

    /** Type of field (input, button, select, etc.) */
    type: string;

    /** Message to show the user to clarify what this field is */
    hint?: string;

    /** If type=input, the value of the input's 'type' attribute (date, text, etc.) */
    subtype?: string;

    /** Initial value of the field, if any */
    value?: any;

    /** If this field is disabled or not */
    disabled?: boolean;

    /** Any validators the field must pass to be considered valid */
    validation?: ValidatorFn[];

    /** Values for enumerated fields */
    options?: string[];
}
