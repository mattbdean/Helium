import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { Validators } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';

import { TableService } from '../core/table.service';
import { DynamicFormComponent } from '../dynamic-form/dynamic-form.component';
import { FieldConfig } from '../dynamic-form/field-config.interface';

import { TableHeader, TableMeta } from '../common/responses';

@Component({
    selector: 'form-host',
    templateUrl: 'form-host.component.html',
    styleUrls: ['form-host.component.scss']
})
export class FormHostComponent implements OnInit {
    @ViewChild(DynamicFormComponent)
    private form: DynamicFormComponent;

    public constructor(
        private backend: TableService,
        private route: ActivatedRoute
    ) { }

    public config: FieldConfig[] = [];
    public name: string;

    public ngOnInit() {
        this.route.params.subscribe(async (params: Params) => {
            this.name = params.name;
            const meta: TableMeta = await this.backend.meta(this.name);
            const config: FieldConfig[] = meta.headers.map((h: TableHeader): FieldConfig => {
                const type = h.enumValues !== null ? 'select' : 'input';

                // Default to string input
                let subtype = 'text';
                // 'boolean' type is usually alias to tinyint(1)
                if (h.rawType === 'tinyint(1)') subtype = 'checkbox';
                // numerical
                else if (h.isNumber) subtype = 'number';
                // Dates and timestamps
                else if (h.type === 'date') subtype = 'date';
                else if (h.type === 'timestamp') subtype = 'datetime-local';

                return {
                    name: h.name,
                    label: h.name,
                    type,
                    subtype,
                    options: h.enumValues
                };
            });

            // Add the submit button
            config.push({
                type: 'submit',
                label: 'SUBMIT',
                name: 'submit'
            });

            this.config = config;
        });
    }

    public onFormSubmitted(event) {
        console.log(event);
    }
}
