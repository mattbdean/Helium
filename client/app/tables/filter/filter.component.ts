import {
    Component, EventEmitter, Input, OnDestroy, OnInit, Output,
    ViewChild
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCheckbox, MatCheckboxChange } from '@angular/material';
import { cloneDeep } from 'lodash';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { FilterOperation, TableMeta } from '../../common/api';
import {
    FormControlSpec, FormControlType
} from '../../dynamic-forms/form-control-spec';
import { FormSpecGeneratorService } from '../../dynamic-forms/form-spec-generator/form-spec-generator.service';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { Operation } from './operation';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html',
    styleUrls: ['filter.component.scss']
})
export class FilterComponent implements OnDestroy, OnInit {
    private static readonly FORM_CONTROL_NAME = 'value';
    private static readonly PLACEHOLDER = 'Value';

    private static readonly defaultSpec: FormControlSpec = {
        type: 'text',
        formControlName: FilterComponent.FORM_CONTROL_NAME,
        placeholder: FilterComponent.PLACEHOLDER,
        required: true
    };

    /**
     * The form group to attach to. Assumes that this is non-null and has three
     * form controls: `param` (for the column picker), `op` (the filter
     * operation), and `value` (user defined value).
     */
    @Input()
    public group: FormGroup;

    /** The current table's headers */
    @Input()
    public meta: TableMeta;

    public allFormControlSpecs: FormControlSpec[] = [];
    public currentSpec: FormControlSpec = FilterComponent.defaultSpec;

    /** Whether or not to show the user input. */
    public showUserInput = true;

    /** Outputs `true` whenever the user clicks the 'remove' button. */
    @Output()
    public removed = new EventEmitter<boolean>(false);

    @ViewChild('checkbox')
    private checkbox: MatCheckbox;

    /** A list of all available filter operations */
    public ops: Operation[];

    public constructor(
        private filters: FilterProviderService,
        private formSpecGenerator: FormSpecGeneratorService
    ) {}

    private sub: Subscription;

    public ngOnInit() {
        this.ops = this.filters.operations();
        this.checkbox.checked = true;
        this.allFormControlSpecs = this.formSpecGenerator.generate(this.meta);

        this.sub = combineLatest(
            // startWith(null) so that we can don't have to wait until the user
            // enters data into both the param and op inputs to react to changes
            this.group.get('param')!!.valueChanges.pipe(startWith(this.group.get('param')!!.value)),
            this.group.get('op')!!.valueChanges.pipe(startWith(this.group.get('op')!!.value))
        ).subscribe((data: [string, FilterOperation]) => {
            const [param, op] = data;

            // For now we're assuming that the 'is' or 'isnot' input types are
            // only being applied to null values.
            this.showUserInput = op !== 'is' && op !== 'isnot';
            if (!this.showUserInput) {
                // Only used when 'Is Null' or 'Is Not Null' is selected
                this.group.patchValue({ value: 'null' });
            }

            // Clone the found spec so we don't mess with anything during future
            // switches
            let newSpec = cloneDeep(this.allFormControlSpecs.find((spec) => {
                return spec.formControlName === param;
            }));

            if (newSpec === undefined)
                newSpec = cloneDeep(FilterComponent.defaultSpec);

            // Adopt the new spec to our FormGroup
            newSpec.formControlName = FilterComponent.FORM_CONTROL_NAME;
            newSpec.placeholder = FilterComponent.PLACEHOLDER;
            newSpec.required = false;

            const val = this.group.get('value')!!.value;
            const newVal = FilterComponent.adaptValue(val, this.currentSpec.type, newSpec.type);
            this.group.patchValue({ value: newVal });
            if (this.currentSpec !== undefined &&
                (newSpec.type === 'date' || newSpec.type === 'datetime') &&
                (this.currentSpec.type !== 'date' && this.currentSpec.type !== 'datetime')) {

                // If going from a non-datetime input to a datetime input, clear
                // the current value since the actual value of the form control
                // will be whatever was there last, but that may or may not be
                // displayed to the user now.
                this.group.patchValue({ value: '' });
            }

            this.currentSpec = newSpec;
        });
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public onToggle(change: MatCheckboxChange) {
        if (change.checked)
            this.group.enable();
        else
            this.group.disable();
    }

    public requestRemove() {
        this.removed.emit(true);
    }

    private static adaptValue(val: any, from: FormControlType, to: FormControlType): any {
        if (val === null || val === undefined)
            return '';

        switch (to) {
            case 'text':
            case 'autocomplete':
                return String(val);
            case 'enum':
                return '';
            case 'boolean':
                return !!val;
            case 'date':
                return from === 'date' ? val : '';
            case 'datetime':
                return from === 'datetime' ? val : '';
        }
    }
}
