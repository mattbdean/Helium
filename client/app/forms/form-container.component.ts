import {
    Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges,
    ViewChild
} from '@angular/core';
import { ValidatorFn, Validators } from '@angular/forms';

import * as _ from 'lodash';

import { Constraint, TableHeader, TableMeta } from '../common/api';
import { createTableName } from '../common/util';
import { TableService } from '../core/table.service';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FieldConfig } from '../dynamic-form/field-config.interface';

@Component({
    selector: 'form-container',
    templateUrl: 'form-container.component.html'
})
export class FormContainerComponent implements OnChanges, OnInit {
    @Input()
    public meta: TableMeta;

    @Input()
    public allowMultiple: boolean = false;

    @Input()
    public allowSubmit: boolean = false;

    @Output()
    public submit: EventEmitter<any> = new EventEmitter();

    @ViewChild(DynamicFormComponent)
    public dynamicForm: DynamicFormComponent;

    private config: FieldConfig[];
    private cleanName: string;

    public constructor(
        private backend: TableService
    ) {}

    /** Clears all data from all dynamic form elements */
    public reset(): void {
        this.dynamicForm.formGroup.reset();
    }

    public ngOnInit(): void {
        this.refreshConfig();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.meta) this.refreshConfig();
    }

    /** Called when the form has been submitted */
    public onFormSubmitted(form: any) {
        this.submit.next(form);
    }

    /** Reinstantiates config and cleanName in case TableMeta has changed */
    private refreshConfig() {
        this.config = this.createConfigFor(this.meta);
        this.cleanName = createTableName(this.meta.name).cleanName;
    }

    private createConfigFor(meta: TableMeta | undefined): FieldConfig[] {
        if (meta === undefined) return [];
        const config = meta.headers.map((h) => this.headerToConfig(h, meta.constraints));

        if (this.allowSubmit) {
            // Add the submit button
            config.push({
                type: 'submit',
                label: 'SUBMIT',
                name: 'submit',
                // Set initially disabled, will become enabled again once the
                // form is valid
                disabled: true
            });
        }

        return config;
    }

    private headerToConfig(h: TableHeader, constraints: Constraint[]): FieldConfig {
        const type = h.enumValues !== null ? 'select' : 'input';

        let initialValue: undefined | any;

        // Default to string input
        let subtype = 'text';

        if (h.type === 'boolean') {
            subtype = 'checkbox';
            // For checkboxes we MUST specify an initial value. If we don't,
            // submitting the form without touching the control will result
            // in an undefined value, instead of false, like the user likely
            // assumes it will be.
            initialValue = false;
        } else if (h.isNumerical) {
            subtype = 'number';
        } else if (h.type === 'date') {
            subtype = 'date';
        } else if (h.type === 'datetime') {
            subtype = 'datetime-local';
        } else if (h.type === 'blob' && h.nullable) {
            initialValue = null;
        }

        const validation: ValidatorFn[] = [];
        if (!h.nullable) validation.push(Validators.required);

        let fetchAutocompleteValues: () => Promise<any[]>;

        const constraint = _.find(constraints, (c) => c.localColumn === h.name);
        if (constraint && constraint.type === 'foreign') {
            fetchAutocompleteValues = () =>
                this.backend.columnValues(constraint.foreignTable, constraint.foreignColumn).toPromise();
        }

        return {
            name: h.name,
            label: h.name,
            type,
            subtype,
            options: h.enumValues,
            validation,
            // hint: h.comment
            fetchAutocompleteValues,
            required: !h.nullable,
            // Submitting types with blobs aren't supported
            disabled: h.type === 'blob',
            value: initialValue
        };
    }
}
