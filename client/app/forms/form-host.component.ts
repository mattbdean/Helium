import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';

import { Subscription } from 'rxjs/Subscription';

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
export class FormHostComponent implements OnInit {
    private nameSub: Subscription;
    private name: TableName;

    public formGroup: FormGroup;

    public constructor(
        private route: ActivatedRoute,
        private fb: FormBuilder
    ) {}

    public ngOnInit() {
        // Empty group to start off with
        this.formGroup = this.fb.group({});
        this.nameSub = this.route.params
            .map((p: Params) => createTableName(p.name))
            .subscribe((name) => {
                this.formGroup = this.fb.group({});
                this.name = name;
            });
    }

    public onSubmit(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        // TODO do something with the submitted form
        // formGroup.value does not contain disabled form controls (necessary
        // for blobs), use this instead
        console.log(this.formGroup.getRawValue());
    }
}
