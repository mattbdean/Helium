import {
    Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';

import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

import * as _ from 'lodash';

import { TableName } from '../common/api';
import { TableService } from '../core/table.service';
import { FormControlSpec } from './form-control-spec.interface';
import { FormSpecGeneratorService } from './form-spec-generator.service';

/**
 * A "partial" form handles data entry for exactly one table. Each instance
 * handles zero or more entries to that table. Upon receiving `rootGroup`, a
 * FormArray is added to that group whose key is the raw name of the table.
 */
@Component({
    selector: 'partial-form',
    templateUrl: 'partial-form.component.html',
    styleUrls: ['partial-form.component.scss']
})
export class PartialFormComponent implements OnChanges, OnInit, OnDestroy {
    /** The table whose data we are creating a form for */
    public get name(): TableName { return this.name$.getValue(); }

    /** The FormGroup from which all other controls are added */
    public get rootGroup(): FormGroup { return this.rootGroup$.getValue(); }

    @Input('name')
    private namePropertyBinding: TableName;
    private name$ = new BehaviorSubject<TableName>(null);

    @Input('rootGroup')
    private rootGroupPropertyBinding: FormGroup;
    private rootGroup$ = new BehaviorSubject<FormGroup>(null);

    @Input('role')
    private role: 'master' | 'part';
    private displayRole: string;

    public formSpec: FormControlSpec[];

    private sub: Subscription;
    private formArray: FormArray;

    public constructor(
        private backend: TableService,
        private formSpecGenerator: FormSpecGeneratorService,
        private fb: FormBuilder
    ) {}

    public ngOnInit() {
        const spec$ = this.name$
            .switchMap((name: TableName) =>
                this.backend.meta(name.rawName)
                    .catch((err) => {
                        // TODO handle better
                        console.error(err);
                        return Observable.never();
                    }
                ))
            .map(this.formSpecGenerator.generate, this);

        // Combine the latest output from the FormControlSpec array generated
        // from the table name/meta and the rootGroup
        this.sub = Observable.zip(
            spec$,
            this.rootGroup$
        )
            .subscribe((data: [FormControlSpec[], FormGroup]) => {
                this.formSpec = data[0];
                this.formArray = this.fb.array([this.createItem(this.formSpec)]);
                data[1].addControl(this.name.rawName, this.formArray);
            });

        this.displayRole = this.role[0].toUpperCase() + this.role.substring(1);
    }

    public ngOnChanges(changes: SimpleChanges): void {
        // Changes to the root group occur when the user switches master table
        // forms
        if (changes.rootGroupPropertyBinding)
            this.rootGroup$.next(changes.rootGroupPropertyBinding.currentValue);
        if (changes.namePropertyBinding)
            this.name$.next(changes.namePropertyBinding.currentValue);
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    private createItem(formSpec: FormControlSpec[]): FormGroup {
        return this.fb.group(_.zipObject(
            _.map(formSpec, (spec) => spec.formControlName),
            _.map(formSpec, (spec) => {
                return this.fb.control({ value: spec.initialValue, disabled: !!spec.disabled }, spec.validation);
            })
        ));
    }
}
