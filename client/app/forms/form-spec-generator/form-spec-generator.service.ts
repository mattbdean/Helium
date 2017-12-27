import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { pickBy } from 'lodash';
import * as moment from 'moment';

import { Observable } from 'rxjs/Observable';
import {
    Constraint, DefaultValue, TableHeader, TableMeta
} from '../../common/api';
import {
    CURRENT_TIMESTAMP,
    DATE_FORMAT,
    DATETIME_FORMAT
} from '../../common/constants';
import { TableName } from '../../common/table-name.class';
import { TableService } from '../../core/table.service';
import {
    FormControlSpec, FormControlType
} from '../form-control-spec.interface';

/**
 * This service is responsible for generating FormControlSpecs given a
 * TableMeta.
 */
@Injectable()
export class FormSpecGeneratorService {
    public constructor(
        private backend: TableService
    ) {}

    /**
     * Generates one FormControlSpec for each header in the given TableMeta.
     * Does not include a submit control.
     */
    public generate(meta: TableMeta, prefilledData: object = {}): FormControlSpec[] {
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
            let disabled = false;
            let autocompleteValues: Observable<string[]> | undefined;

            const foreignKey = meta.constraints.find(
                (constraint) => constraint.type === 'foreign' && constraint.localColumn === h.name);

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
                    break;
                case 'date':
                case 'datetime':
                    type = 'date';
                    // datetime-local used for dates and times
                    subtype = h.type === 'date' ? 'date' : 'datetime-local';
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
                const ref = foreignKey.ref;
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
                defaultValue: FormSpecGeneratorService.defaultValue(h, prefilledData)
            };

            // Don't specifically define undefined values as undefined. Messes
            // with tests. { a: 1, b: undefined } does NOT deep equal
            // { a: 1 }.
            return pickBy(spec, (value) => value !== undefined) as FormControlSpec;
        });
    }

    /**
     * Since entries to part tables have to be inserted at the same time as
     * the master table they reference, foreign keys have to match exactly the
     * value of the primary key of the master column, creating a "binding."
     * Consider this situation:
     *
     * CREATE TABLE master(
     *   pk INTEGER PRIMARY KEY
     * )
     *
     * CREATE TABLE master__part(
     *   fk_master INTEGER,
     *   fk_other INTEGER,
     *   FOREIGN KEY (fk_master) REFERENCES master(pk)
     *   FOREIGN KEY (fk_other) REFERENCES foo(bar)
     * )
     *
     * In this example, master__part.fk_master is a binding constraint, while
     * master__part.fk_other is not.
     *
     * @param {string} masterRawName The SQL name of the master table's name. If
     *                               null, an empty array will be returned
     *                               (signifying this table is a master table).
     * @param {TableMeta} tableMeta The metadata for the part table
     * @returns {Constraint[]} An array of binding constraints in this master/
     *                         part relationship.
     */
    public bindingConstraints(masterRawName: string | null, tableMeta: TableMeta): Constraint[] {
        if (masterRawName === null)
            // The given TableMeta is for a master table, nothing to do
            return [];

        const tableName = new TableName(tableMeta.schema, tableMeta.name);
        if (tableName.masterRawName !== masterRawName)
            throw new Error(`Given TableMeta was not a part table of ` +
                `${masterRawName}, but actually for ${tableName.masterRawName}`);

        return tableMeta.constraints.filter((c) => c.ref !== null && c.ref.table === masterRawName);
    }

    /**
     * Tries to determine the most appropriate default value for the given
     * header. If prefilledData is given, `prefilledData[header.name]` will be
     * used if that header is not a primary key.
     */
    private static defaultValue(header: TableHeader, prefilledData: object): DefaultValue {
        let defaultValue: DefaultValue = header.defaultValue;
        if (prefilledData[header.name] !== undefined)
            defaultValue = prefilledData[header.name];

        switch (header.type) {
            case 'blob':
                return header.nullable ? null : undefined;
            case 'date':
            case 'datetime':
                if (typeof defaultValue === 'string' && defaultValue !== undefined) {
                    // Parse the string into a Date
                    const format = header.type === 'date' ? DATE_FORMAT : DATETIME_FORMAT;
                    defaultValue = moment(defaultValue, format).toISOString();
                }

                if ((defaultValue as any || {}).constantName === CURRENT_TIMESTAMP ||
                    defaultValue === null ||
                    defaultValue === undefined)

                    // Use an ISO 8601 formatted string so any Angular Material
                    // Date adapter can take it. If we gave it a Date object and
                    // we switched to the Moment Date Adapter (if it comes out),
                    // then we'd have to do some refactoring.
                    defaultValue = new Date().toISOString();
                break;
            case 'boolean':
                // An initial value of 'undefined' looks exactly the same as
                // an initial value of false, except the user will expect an
                // unchecked checkbox to represent 'false' instead of null.
                defaultValue = !(defaultValue === null || defaultValue === undefined);
        }

        return defaultValue;
    }
}
