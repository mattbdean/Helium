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
}
