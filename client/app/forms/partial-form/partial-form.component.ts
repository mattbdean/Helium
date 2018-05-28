import { animate, style, transition, trigger } from '@angular/animations';
import {
    Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material';
import * as _ from 'lodash';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Constraint, SqlRow, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { flattenCompoundConstraints } from '../../common/util';
import { FormControlSpec } from '../../dynamic-forms/form-control-spec';
import { FormSpecGeneratorService } from '../../dynamic-forms/form-spec-generator/form-spec-generator.service';
import { RowPickerDialogComponent, RowPickerParams } from '../row-picker-dialog/row-picker-dialog.component';

interface Binding {
    controlName: string;
    valueChanges: Observable<any>;
    subscriptions: Subscription[];
    lastValue: any;
}

/**
 * A "partial" form handles data entry for exactly one table. Each instance
 * handles zero or more entries to that table. Upon receiving `rootGroup`, a
 * FormArray is added to that group whose key is the raw name of the table.
 *
 * If this form is for a part table, it is possible that one or more of the
 * controls in each FormGroup in the FormArray can be "bound" to another
 * control. When this happens, the control will be disabled and will
 * automatically update to the value of the control in the master table that
 * it's bound to. Bound controls are hidden from the user.
 *
 * @see FormSpecGeneratorService.bindingConstraints
 */
@Component({
    selector: 'partial-form',
    templateUrl: 'partial-form.component.html',
    styleUrls: ['partial-form.component.scss'],
    animations: [
        trigger('fade', [
            transition(':enter', [
                style({ height: 0, opacity: 0 }),
                animate('0.5s ease-out', style({ height: '*', opacity: 1 }))
            ]),
            transition(':leave', [
                style({ height: '*', opacity: 1 }),
                animate('0.5s ease-out', style({ height: 0, opacity: 0 }))
            ])
        ])
    ]
})
export class PartialFormComponent implements OnChanges, OnInit, OnDestroy {
    /** The table whose data we are creating a form for */
    public get meta(): TableMeta { return this.meta$.getValue()!!; }

    /** The FormGroup from which all other controls are added */
    public get rootGroup(): FormGroup { return this.rootGroup$.getValue()!!; }

    public name$: Observable<TableName>;

    @Input('meta')
    public metaPropertyBinding: TableName;
    private meta$ = new BehaviorSubject<TableMeta | null>(null);

    @Input('rootGroup')
    public rootGroupPropertyBinding: FormGroup;
    private rootGroup$ = new BehaviorSubject<FormGroup | null>(null);

    @Input()
    public role: 'master' | 'part';

    @Input()
    public prefilled: SqlRow[] = [];

    public formSpec: FormControlSpec[];

    private sub: Subscription;
    public formArray: FormArray;

    /** A list of all bound controls for this form */
    private bindings: Binding[] = [];

    private lastValueWatchers: { [controlName: string]: Subscription } = {};

    public constructor(
        private formSpecGenerator: FormSpecGeneratorService,
        private fb: FormBuilder,
        private dialog: MatDialog
    ) {}

    public ngOnInit() {
        const spec$ = this.meta$.map((meta) =>
            this.formSpecGenerator.generate(meta!!, (colName) => this.onRequestRowPicker(colName)));

        this.name$ = this.meta$.map((m) => new TableName('(unused)', m!!.name));

        // Combine the latest output from the FormControlSpec array generated
        // from the table name/meta and the rootGroup
        this.sub = Observable.zip(
            this.meta$,
            this.rootGroup$,
            spec$,
        )
            // This is required since altering the FormGroup in the subscribe()
            // causes its "valid" property to change while Angular is still
            // running change detection, resulting in an error in dev mode.
            .debounceTime(0)
            .subscribe((data: [TableMeta, FormGroup, FormControlSpec[]]) => {
                const [tableMeta, rootFormGroup, formSpec] = data;
                this.formSpec = formSpec;
                const name = new TableName('(unused)', tableMeta.name);

                // Master tables start off with one entry
                const prefilled: Array<SqlRow | null> =
                    this.role === 'master' && this.prefilled.length === 0 ?
                        [null] : this.prefilled;

                const initialControls = prefilled.map((p) =>
                    this.createItem(this.formSpec, p));

                this.formArray = this.fb.array(initialControls);
                rootFormGroup.addControl(name.name.raw, this.formArray);

                const masterRawName = name.masterName ? name.masterName.raw : null;
                const bindings = this.formSpecGenerator.bindingConstraints(masterRawName, tableMeta);
                // If we have binding constraints, this is guaranteed to be a
                // part table
                if (bindings.length > 0) {
                    // The FormGroup for the master table is created first
                    const masterFormArray =
                        rootFormGroup.controls[name.masterName!!.raw] as FormArray;

                    // The master table form array only contains one entry
                    const masterGroup = masterFormArray.at(0) as FormGroup;

                    for (const binding of bindings) {
                        // Make a note of what local control should be bound to
                        // what Observable
                        const b = {
                            controlName: binding.localColumn,
                            valueChanges: masterGroup.controls[binding.ref!!.column].valueChanges,
                            subscriptions: [],
                            lastValue: ''
                        };
                        this.bindings.push(b);

                        // Subscribe to the observable so we know what value to
                        // give a newly created bound form control
                        this.lastValueWatchers[binding.localColumn] =
                            b.valueChanges.subscribe((value) => {
                                b.lastValue = value;
                            });
                    }
                }
            });
    }

    public ngOnChanges(changes: SimpleChanges): void {
        // Changes to the root group occur when the user switches master table
        // forms
        if (changes.rootGroupPropertyBinding)
            this.rootGroup$.next(changes.rootGroupPropertyBinding.currentValue);
        if (changes.metaPropertyBinding)
            this.meta$.next(changes.metaPropertyBinding.currentValue);
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();

        for (const controlName of Object.keys(this.lastValueWatchers))
            this.lastValueWatchers[controlName].unsubscribe();

        for (const binding of this.bindings)
            for (const sub of binding.subscriptions)
                sub.unsubscribe();
    }

    public addEntry() {
        this.formArray.push(this.createItem(this.formSpec, null));
    }

    public removeEntry(index) {
        if (index >= this.formArray.length)
            throw new Error(`Tried to remove control at index ${index}, but ` +
                `length was ${this.formArray.length}`);

        // Make sure to unsubscribe to any bindings before removing the control.
        // For every binding, remove the subscription at the given index.
        for (const binding of this.bindings) {
            // Unsubscribe and remove the Subscription from the array
            binding.subscriptions[index].unsubscribe();
            binding.subscriptions.slice(index, 1);
        }

        this.formArray.removeAt(index);
    }

    public shouldBeHidden(formControlName: string) {
        const binding = _.find(this.bindings, (b) => b.controlName === formControlName);
        return binding !== undefined;
    }

    public onRequestRowPicker(colName: string) {
        const foreignKeys = flattenCompoundConstraints(this.meta.constraints)
            .filter((c) => c.type === 'foreign');
        // Try to find the foreign key associated with the given column 
        const foreignKey = foreignKeys.find((c: Constraint) => c.localColumn === colName);
        
        if (foreignKey === undefined)
            throw new Error(`Cannot show row picker for column ${colName}: not a foreign key`);

        const ref = foreignKey.ref!!;

        // Open the dialog to let the user pick a row
        const params: RowPickerParams = {
            tableName: ref.table,
            schemaName: ref.schema
        };
        const dialogRef = this.dialog.open(RowPickerDialogComponent, {
            data: params
        });

        const unused = foreignKeys.slice(0);

        dialogRef.afterClosed().subscribe((data: SqlRow) => {
            console.log('Got data back to partial form:', data);
            // TODO handle multiple entries in formArray

            const patch: { [col: string]: any } = {};

            for (const referencedColumn of Object.keys(data)) {
                const index = unused.findIndex((c) => c.ref!!.column === referencedColumn);

                // Not a foreign key, ignore
                if (index < 0)
                    continue;
                
                const key = unused.splice(index, 1)[0];

                this.formArray.at(0);
                patch[key.localColumn] = data[referencedColumn];
            }
            const group: FormGroup = this.formArray.at(0) as FormGroup;

            group.patchValue(patch);
        });
    }

    /**
     * Creates a new FormGroup according to the given FormControlSpecs. This
     * function automatically takes care of binding the appropriate controls.
     */
    private createItem(formSpec: FormControlSpec[], initialData: SqlRow | null): FormGroup {
        const names = _.map(formSpec, (spec) => spec.formControlName);
        return this.fb.group(_.zipObject(
            names,
            _.map(formSpec, (spec, index) => {
                const controlName = names[index];

                // Look for a binding for the current form control name
                const binding = _(this.bindings).find((b) => b.controlName === controlName);

                // Fall back to the spec's initial value if there is no binding
                // for this particular control
                // const initialValue = binding ? binding.lastValue : spec.defaultValue;

                let initialValue = spec.defaultValue;
                if (binding)
                    initialValue = binding.lastValue;
                if (initialData !== null && !_.isNil(initialData[controlName]))
                    initialValue = initialData[controlName];

                // Create the actual form control. Bound controls are always
                // disabled.
                const conf = {
                    value: initialValue,
                    disabled: !!spec.disabled || binding !== undefined
                };
                const control = this.fb.control(conf, spec.validation);

                if (binding !== undefined) {
                    // Do the actual "binding" -- whenever we get a new value
                    // from the master table's FormControl, update the bound
                    // control's value.
                    binding.subscriptions.push(binding.valueChanges.subscribe((value) => {
                        control.setValue(value);
                    }));
                }

                return control;
            })
        ));
    }
}
