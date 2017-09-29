import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { pickBy } from 'lodash';

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

            // booleans require no validation
            if (h.type !== 'boolean') {
                if (!h.nullable)
                    validators.push(Validators.required);
                if (h.maxCharacters)
                    validators.push(Validators.maxLength(h.maxCharacters));
            }

            let type: FormControlType = 'text';
            let subtype: FormControlSubtype | undefined;
            let enumValues: string[] | undefined;
            let initialValue: any | undefined;

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
                default:
                    // TODO throw an error instead
                    subtype = 'text';
            }

            const spec = {
                type,
                subtype,
                formControlName: h.name,
                placeholder: h.name,
                validation: validators,
                enumValues,
                initialValue
            };

            // Don't specifically define undefined values as undefined. Messes
            // with tests. { a: 1, b: undefined } does NOT deep equal
            // { a: 1 }.
            return pickBy(spec, (value) => value !== undefined);
        });
    }
}
