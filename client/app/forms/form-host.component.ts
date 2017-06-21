import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { Validators } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';
import { DynamicFormComponent } from './../dynamic-form/dynamic-form.component';

import { TableService } from '../core/table.service';
import { FieldConfig } from '../dynamic-form/field-config.interface';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html'
})
export class FormHostComponent implements OnInit {
    @ViewChild(DynamicFormComponent)
    private form: DynamicFormComponent;

    public constructor(
        private backend: TableService,
        private route: ActivatedRoute
    ) { }

    public config: FieldConfig[] = [
        {
            type: 'input',
            label: 'Full name',
            name: 'name',
            validation: [Validators.required]
        },
        {
            type: 'select',
            label: 'Favourite food',
            name: 'food',
            options: ['Pizza', 'Hot Dogs', 'Knakworstje', 'Coffee']
        },
        {
            label: 'Submit',
            name: 'submit',
            type: 'button'
        }
    ];

    public ngOnInit() {
        this.route.params.subscribe((params: Params) => {
            const name = params.name;
            const meta = this.backend.meta(name);
        });
    }

    public onFormSubmitted(event) {
        console.log(event);
    }
}
