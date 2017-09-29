import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { pickBy } from 'lodash';

import { TableMeta } from '../common/api';
import {
    FormControlSpec, FormControlType
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
            let required = false;

            // booleans require no validation
            if (h.type !== 'boolean') {
                if (!h.nullable) {
                    validators.push(Validators.required);
                    required = true;
                }
                if (h.maxCharacters)
                    validators.push(Validators.maxLength(h.maxCharacters));
            }

            let type: FormControlType = 'text';
            let subtype: string | undefined;
            let enumValues: string[] | undefined;
            let initialValue: any | undefined;
            let disabled = false;

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
                case 'boolean':
                    type = 'boolean';
                    // An initial value of 'undefined' looks exactly the same as
                    // an initial value of false, except the user will expect an
                    // unchecked checkbox to represent 'false' instead of null.
                    initialValue = false;
                    break;
                case 'date':
                case 'datetime':
                    type = 'date';
                    // datetime-local used for dates and times
                    subtype = h.type === 'date' ? 'date' : 'datetime-local';
                    break;
                case 'blob':
                    type = 'text';
                    // Since blobs aren't supported, we only allow entering
                    // null values. Disable all blob controls and set the initial
                    // value to null only if the header is nullable.
                    initialValue = h.nullable ? null : undefined;
                    disabled = true;
                    break;
                default:
                    // TODO throw an error instead
                    subtype = 'text';
            }

            const spec: FormControlSpec = {
                type,
                subtype,
                formControlName: h.name,
                placeholder: h.name,
                validation: validators,
                enumValues,
                initialValue,
                required,
                disabled
            };

            // Don't specifically define undefined values as undefined. Messes
            // with tests. { a: 1, b: undefined } does NOT deep equal
            // { a: 1 }.
            return pickBy(spec, (value) => value !== undefined);
        });
    }
}
