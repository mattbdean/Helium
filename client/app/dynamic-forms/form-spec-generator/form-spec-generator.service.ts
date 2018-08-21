import { Injectable } from '@angular/core';
import { ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { flatten, pickBy } from 'lodash';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import { flattenCompoundConstraints } from '../../../../common/util';
import {
    DefaultValue, TableHeader, TableMeta
} from '../../common/api';
import {
    CURRENT_TIMESTAMP,
    DATE_FORMAT,
    DATETIME_FORMAT
} from '../../common/constants';
import { ApiService } from '../../core/api/api.service';
import { DatetimeInputComponent } from '../../core/datetime-input/datetime-input.component';
import { validateInteger } from '../../tables/paginator/page-index.validator';
import {
    FormControlSpec, FormControlType
} from '../form-control-spec';

/**
 * This service is responsible for generating FormControlSpecs given a
 * TableMeta.
 */
@Injectable()
export class FormSpecGeneratorService {
    public constructor(
        private backend: ApiService
    ) {}

    /**
     * Generates one FormControlSpec for each header in the given TableMeta.
     * Does not include a submit control.
     */
    public generate(meta: TableMeta, onRequestRowPicker?: (columnName: string) => void): FormControlSpec[] {
        return meta.headers.map((h): FormControlSpec => {
            const validators: ValidatorFn[] = [];
            let required = false;

            // Booleans require no validation. For non-nullable strings, the
            // default will be an empty string when there is no default.
            if (h.type !== 'boolean' && h.type !== 'string' && !h.nullable) {
                validators.push(Validators.required);
                required = true;
            }
            if (h.maxCharacters)
                validators.push(Validators.maxLength(h.maxCharacters));

            let type: FormControlType = 'text';
            let subtype: string | undefined;
            let enumValues: string[] | undefined;
            let disabled = false;
            let autocompleteValues: Observable<string[]> | undefined;

            const flattenedConstraints = flattenCompoundConstraints(meta.constraints);

            const foreignKey = flattenedConstraints.find(
                (constraint) => constraint.type === 'foreign' && constraint.localColumn === h.name);

            switch (h.type) {
                case 'string':
                    subtype = 'text';
                    break;
                case 'float':
                case 'integer':
                    subtype = 'number';
                    if (!h.signed)
                        validators.push(Validators.min(0));
                    
                    if (h.type === 'integer') {
                        validators.push((control): ValidationErrors | null => {
                            // Ignore missing values, they'll be handled by
                            // Validators.required if applicable
                            if (control.value === '' || control.value === null || control.value === undefined)
                                return null;

                            const key = 'integer';
                            const integer = validateInteger(control.value);
                            return integer === null ? { [key]: 'Not an integer' } : null;
                        });
                    }
                    break;
                case 'enum':
                    type = 'enum';
                    enumValues = h.enumValues === null ? undefined : h.enumValues;
                    break;
                case 'boolean':
                    type = 'boolean';
                    break;
                case 'date':
                    type = 'date';
                    break;
                case 'datetime':
                    type = 'datetime';
                    break;
                case 'blob':
                    type = 'text';
                    disabled = true;
                    break;
                default:
                    // TODO throw an error instead
                    subtype = 'text';
            }

            if (foreignKey !== undefined) {
                const ref = foreignKey.ref!!;
                autocompleteValues = this.backend.columnValues(
                    ref.schema, ref.table, ref.column);
                type = 'autocomplete';
            }

            const spec: FormControlSpec = {
                type,
                subtype,
                formControlName: h.name,
                placeholder: h.name,
                validation: validators,
                enumValues,
                required,
                disabled,
                autocompleteValues,
                defaultValue: FormSpecGeneratorService.defaultValue(h),
                hoverHint: h.rawType,
                onRequestRowPicker
            };

            // Don't specifically define undefined values as undefined. Messes
            // with tests. { a: 1, b: undefined } does NOT deep equal
            // { a: 1 }.
            return pickBy(spec, (value) => value !== undefined) as FormControlSpec;
        });
    }

    /**
     * Tries to determine the most appropriate default value for the given
     * header. If prefilledData is given, `prefilledData[header.name]` will be
     * used if that header is not a primary key.
     */
    private static defaultValue(header: TableHeader): DefaultValue {
        let defaultValue: DefaultValue = header.defaultValue;

        switch (header.type) {
            case 'blob':
                return null;
            case 'date':
            case 'datetime':
                let date: Date | null = null;
                if ((defaultValue || {} as any).constantName === CURRENT_TIMESTAMP ||
                    defaultValue === null ||
                    defaultValue === undefined) {

                    date = new Date();
                } else if (typeof defaultValue === 'string') {
                    // Parse the string into a Date
                    const format = header.type === 'date' ? DATE_FORMAT : DATETIME_FORMAT;
                    const m = moment(defaultValue, format);
                    if (!m.isValid()) {
                        throw new Error('Invalid date: ' + defaultValue);
                    }

                    date = m.toDate();
                }

                if (date === null)
                    throw new Error('Could not parse as date: ' + defaultValue);

                defaultValue = moment(date).format(
                    header.type === 'date' ?
                        DatetimeInputComponent.DATE_INPUT_FORMAT :
                        DatetimeInputComponent.DATETIME_INPUT_FORMAT);
                break;
            case 'boolean':
                // An initial value of 'undefined' looks exactly the same as
                // an initial value of false, except the user will expect an
                // unchecked checkbox to represent 'false' instead of null.
                defaultValue = !(defaultValue === null || defaultValue === undefined);
                break;
            case 'string':
                if (!header.nullable && defaultValue === null)
                    defaultValue = '';
                break;
        }

        return defaultValue;
    }
}
