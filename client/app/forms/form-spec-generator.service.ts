import { Injectable } from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import { pickBy } from 'lodash';

import { Constraint, TableMeta, TableName } from '../common/api';
import {
    FormControlSpec, FormControlType
} from './form-control-spec.interface';
import { Observable } from 'rxjs/Observable';
import { TableService } from '../core/table.service';
import { createTableName } from '../common/util';

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

            if (foreignKey !== undefined) {
                autocompleteValues = this.backend.columnValues(
                    foreignKey.foreignTable, foreignKey.foreignColumn);
                type = 'autocomplete';
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
                disabled,
                autocompleteValues
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
     * @param {TableMeta} tableMeta The metadata for the part table
     * @returns {Constraint[]} An array of binding constraints in this master/
     *                         part relationship.
     */
    public bindingConstraints(masterRawName: string, tableMeta: TableMeta): Constraint[] {
        if (masterRawName === null)
            // The given TableMeta is for a master table, nothing to do
            return [];

        const tableName = createTableName(tableMeta.name);
        if (tableName.masterRawName !== masterRawName)
            throw new Error(`Given TableMeta was not a part table of ` +
                `${masterRawName}, but actually for ${tableName.masterRawName}`);

        return tableMeta.constraints.filter((c) => c.foreignTable === masterRawName);
    }
}
