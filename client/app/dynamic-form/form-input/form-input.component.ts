import { Component, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { Observable } from 'rxjs/Observable';

import { FieldConfig } from '../field-config.interface';

@Component({
    selector: 'form-input',
    templateUrl: 'form-input.component.html',
    styles: [`
        md-input-container { width: 100%; }
        :host >>> .mat-checkbox-layout { padding-bottom: 10px; }
    `]
})
export class FormInputComponent implements OnInit {
    public config: FieldConfig;
    public group: FormGroup;

    /** An observable of the current autocomplete values */
    public filteredValues: Observable<string[]>;

    /** All possible autocomplete values */
    private allValues: any[];

    public async ngOnInit() {
        if (this.config.fetchAutocompleteValues) {
            this.allValues = await this.config.fetchAutocompleteValues();
            this.filteredValues = this.group.get(this.config.name).valueChanges
                .startWith(null)
                .map((val) => this.filterValues(val));
        }
    }

    private filterValues(val: string): string[] {
        if (val === null || val === undefined) return this.allValues;

        const asStrings = this.allValues.map((v) => v.toString().toLowerCase());
        const valStr = val.toString();

        // Only include values from `asStrings` that start with `valStr`
        return asStrings.filter((s) => s.indexOf(valStr) === 0);
    }
}
