import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';

import { Subscription } from 'rxjs/Subscription';

import { MasterTableName, TableName } from '../common/api';
import { createTableName, unflattenTableNames } from '../common/util';
import { Observable } from 'rxjs/Observable';
import { TableService } from '../core/table.service';

/**
 * This component creates a dynamically generated form based on the 'name'
 * parameter of the current route.
 */
@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnDestroy, OnInit {
    public formGroup: FormGroup;
    private sub: Subscription;
    private mainName: MasterTableName = null;
    private names: TableName[] = [];

    public constructor(
        private route: ActivatedRoute,
        private router: Router,
        private fb: FormBuilder,
        private backend: TableService
    ) {}

    public ngOnInit() {
        // Empty group to start off with
        this.formGroup = this.fb.group({});

        this.sub = Observable.combineLatest(
            this.backend.list(),
            this.route.params.map((p: Params) => p.name)
        )
            .switchMap((data: [TableName[], string]): Observable<MasterTableName> => {
                // Try to identify a MasterTableName for the given raw SQL name
                const allNames = data[0];
                const currentRawName = data[1];

                const currentName = allNames.find((n) => n.rawName === currentRawName);
                if (currentName === undefined || currentName.masterRawName !== null) {
                    // The user has navigated to a table that doesn't exist or a
                    // part table
                    let newPath: string[];

                    if (currentName === undefined)
                        newPath = ['/tables'];
                    else
                        newPath = ['/forms', currentName.masterRawName];

                    return Observable.fromPromise(this.router.navigate(newPath))
                        .switchMapTo(Observable.never());
                }

                const masterTableNames = unflattenTableNames(allNames);
                const currentMaster =
                    masterTableNames.find((n) => n.rawName === currentRawName);
                return Observable.of(currentMaster);
            })
            .subscribe((mainName: MasterTableName) => {
                // Reinitialize the FormGroup so that we don't keep data from
                // previously created forms
                this.formGroup = this.fb.group({});

                this.mainName = mainName;
                // The TableName array we use to create PartialFormComponents
                // is comprised of the mainName (as a TableName instead of a
                // MasterTableName) and its parts.
                this.names = [createTableName(mainName.rawName), ...this.mainName.parts];
            });
    }

    /**
     * This function transforms form data from the format represented by Angular
     * into a format the API expects.
     */
    public prepareSubmit(form: object): object {
        // The only thing we're guaranteed here is that there will be exactly
        // one master table entry
        const master = form[this.mainName.rawName][0];

        const processed: object = {};

        // Transfer all master properties to the root of the processed form
        for (const key of Object.keys(master)) {
            processed[key] = master[key];
        }

        // Identify any part table names
        const partTableNames = Object.keys(form)
            .filter((k) => k !== this.mainName.rawName);

        // Add the special $parts key for part tables
        if (partTableNames.length > 0) {
            processed['$parts'] = {};
        }

        // Add all part tables to the $parts object under the clean name
        for (const partTable of partTableNames) {
            const cleanName = createTableName(partTable).cleanName;
            processed['$parts'][cleanName] = form[partTable];
        }

        return processed;
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public onSubmit(event: Event) {
        event.preventDefault();
        event.stopPropagation();
        // TODO do something with the submitted form
        // formGroup.value does not contain disabled form controls (necessary
        // for blobs and bound part table foreign keys), use
        // formGroup.getRawValue() instead
        console.log('Submit data: ', this.prepareSubmit(this.formGroup.getRawValue()));
    }
}
