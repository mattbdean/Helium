import {
    Component, EventEmitter, Input, OnInit, Output,
    ViewChild
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCheckbox, MatCheckboxChange } from '@angular/material';
import { FilterOperation, TableHeader } from '../../common/api';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { Operation } from './operation';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html',
    styleUrls: ['filter.component.scss']
})
export class FilterComponent implements OnInit {
    @Input()
    public group: FormGroup;

    @Input()
    public headers: TableHeader[] = [];

    public showCustomInput = true;

    @Output()
    public removed = new EventEmitter<boolean>(false);

    @ViewChild('checkbox')
    private checkbox: MatCheckbox;

    public ops: Operation[];

    public constructor(private filters: FilterProviderService) {}

    public ngOnInit() {
        this.ops = this.filters.operations();
        this.checkbox.checked = true;

        this.group.get('op')!!.valueChanges.subscribe((op: FilterOperation) => {
            // For right now, `is` and `isnot` are exclusively for null testing
            const managed = op === 'is' || op === 'isnot';

            // If changing from 'is' or 'isnot' to anything else, clear the
            // custom value input. If we don't do this, the value will still be
            // `null`, which probably isn't what the user wants.
            if (!this.showCustomInput && !managed) {
                this.group.patchValue({ value: '' });
            }

            // Hide the `value` input if necessary
            this.showCustomInput = !managed;

            // If set to `is` or `isnot`, the assume we're talking about nulls
            if (managed)
                this.group.patchValue({ value: 'null' });
        });
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
}
