import { Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { FormControlSpec } from '../form-control-spec';

/**
 * Base class for all dynamic reactive form controls.
 */
export abstract class AbstractFormControl {
    @Input()
    public spec: FormControlSpec;

    @Input()
    public group: FormGroup;

    /**
     * Gets a message for the first presented error, or null if there is none.
     */
    public currentError(): string | null {
        const control = this.group.get(this.spec.formControlName);

        // Control hasn't been initialized or it's valid. Either way, no error
        if (control === null || control.valid || !control.errors)
            return null;
        
        const errors = control.errors;
        const firstKey = Object.keys(errors)[0];
        const data = errors[firstKey];

        switch (firstKey) {
            case 'required':
                return 'A value is required';
            case 'min':
                return 'Must be at least ' + data.min;
            case 'maxlength':
                return `Too many characters (max ${data.requiredLength})`;
            case 'integer':
                return data;
        }

        throw new Error(`Unknown validator: '${firstKey}': ${JSON.stringify(data)}`);
    }
}
