import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup} from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { Subscription } from 'rxjs/Subscription';

import * as _ from 'lodash';

import { TableService } from '../core/table.service';
import { FormControlSpec } from './form-control-spec.interface';
import { FormSpecGeneratorService } from './form-spec-generator.service';
import { TableName } from '../common/api';
import { createTableName } from '../common/util';

/**
 * This component creates a dynamically generated form based on the 'name'
 * parameter of the current route.
 */
@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnInit, OnDestroy {
    public formGroup: FormGroup;
    public controls: FormControlSpec[];
    public name: TableName;

    private nameSub: Subscription;

    public constructor(
        private backend: TableService,
        private formSpecGenerator: FormSpecGeneratorService,
        private fb: FormBuilder,
        private route: ActivatedRoute
    ) {}

    public ngOnInit() {
        // Empty group to start off with
        this.formGroup = this.fb.group({});

        this.nameSub = this.route.params
            .map((p: Params) => p.name)
            .switchMap((name: string) => {
                this.name = createTableName(name);
                return this.backend.meta(name)
                    .catch((err) => {
                        // TODO handle better
                        throw err;
                    });
            })
            .map(this.formSpecGenerator.generate, this)
            .map((formSpec: FormControlSpec[]) => [formSpec, this.createFormGroup(formSpec)], this)
            .subscribe((data: [FormControlSpec[], FormGroup]) => {
                this.controls = data[0];
                this.formGroup = data[1];
            });
    }

    public ngOnDestroy() {
        this.nameSub.unsubscribe();
    }

    public onSubmit(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        // TODO do something with the submitted form
        console.log(this.formGroup.value);
    }

    private createFormGroup(formSpec: FormControlSpec[]): FormGroup {
        return this.fb.group(_.zipObject(
            _.map(formSpec, (spec) => spec.formControlName),
            _.map(formSpec, (spec) => {
                return this.fb.control('', spec.validation);
            })
        ));
    }
}
