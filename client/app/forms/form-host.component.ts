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
            .flatMap((data: [TableName[], string]): Observable<MasterTableName> => {
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
                        .mapTo(null as MasterTableName);
                }

                const masterTableNames = unflattenTableNames(allNames);
                const currentMaster =
                    masterTableNames.find((n) => n.rawName === currentRawName);
                return Observable.of(currentMaster);
            })
            .subscribe((mainName: MasterTableName) => {
                this.mainName = mainName;
                // The TableName array we use to create PartialFormComponents
                // is comprised of the mainName (as a TableName instead of a
                // MasterTableName) and its parts.
                this.names = [createTableName(mainName.rawName), ...this.mainName.parts];
            });
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
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
