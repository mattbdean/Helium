import { Injectable } from '@angular/core';
import { Validators } from '@angular/forms';

import { TableMeta } from '../common/api';
import { FormControlSpec } from './form-control-spec.interface';

/**
 * This service is responsible for generating FormControlSpecs given a
 * TableMeta.
 */
@Injectable()
export class FormSpecGeneratorService {
    public generate(meta: TableMeta): FormControlSpec[] {
        return meta.headers.map((h): FormControlSpec => ({
            formControlName: h.name,
            placeholder: h.name,
            validation: !h.nullable ? [Validators.required] : []
        }));
    }
}
