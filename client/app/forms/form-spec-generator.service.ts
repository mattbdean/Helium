import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { TableMeta } from '../common/api';
import {
    FormControlSpec,
    FormControlSubtype, FormControlType
} from './form-control-spec.interface';

/**
 * This service is responsible for generating FormControlSpecs given a
 * TableMeta.
 */
@Injectable()
export class FormSpecGeneratorService {
    /**
     * Generates one FormControlSpec for each header in the given TableMeta.
     * Does not include a submit control.
     */
    public generate(meta: TableMeta): FormControlSpec[] {
        return meta.headers.map((h): FormControlSpec => {
            const validators: ValidatorFn[] = [];
            if (!h.nullable)
                validators.push(Validators.required);
            if (h.maxCharacters)
                validators.push(Validators.maxLength(h.maxCharacters));

            let type: FormControlType = 'text';
            let subtype: FormControlSubtype | undefined;
            let enumValues: string[] | undefined;

            switch (h.type) {
                case 'string':
                    subtype = 'text';
                    break;
                case 'float':
                case 'integer':
                    subtype = 'number';
                    break;
                case 'enum':
                    type = 'enum';
                    enumValues = h.enumValues;
                    break;
                default:
                    // TODO throw an error instead
                    subtype = 'text';
            }

            return {
                type,
                subtype,
                formControlName: h.name,
                placeholder: h.name,
                validation: validators,
                enumValues,
            };
        });
    }
}
