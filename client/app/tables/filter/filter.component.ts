import {
    Component, EventEmitter, Input, OnDestroy, OnInit, Output,
    ViewChild
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCheckbox, MatCheckboxChange } from '@angular/material';
import { Observable } from 'rxjs/Observable';
import { FilterOperation, TableHeader } from '../../common/api';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { Operation } from './operation';
import { Subscription } from 'rxjs/Subscription';

type InputType = 'none' | 'datetime' | 'normal';

@Component({
    selector: 'filter',
    templateUrl: 'filter.component.html',
    styleUrls: ['filter.component.scss']
})
export class FilterComponent implements OnDestroy, OnInit {
    /**
     * The form group to attach to. Assumes that this is non-null and has three
     * form controls: `param` (for the column picker), `op` (the filter
     * operation), and `value` (user defined value).
     */
    @Input()
    public group: FormGroup;

    /** The current table's headers */
    @Input()
    public headers: TableHeader[] = [];

    /**
     * Whether or not to show the user input. Equivalent to
     * `this.inputType === 'none'`
     */
    public get showUserInput() { return this.inputType !== 'none'; }

    /** Outputs `true` whenever the user clicks the 'remove' button. */
    @Output()
    public removed = new EventEmitter<boolean>(false);

    @ViewChild('checkbox')
    private checkbox: MatCheckbox;

    /** A list of all available filter operations */
    public ops: Operation[];

    /**
     * What kind of input to provide to the user based on the selected column
     * and filter operation
     */
    public inputType: InputType;

    public constructor(private filters: FilterProviderService) {}

    private sub: Subscription;

    public ngOnInit() {
        this.ops = this.filters.operations();
        this.checkbox.checked = true;

        this.sub = Observable.combineLatest(
            // startWith(null) so that we can don't have to wait until the user
            // enters data into both the param and op inputs to react to changes
            this.group.get('param')!!.valueChanges.startWith(null),
            this.group.get('op')!!.valueChanges.startWith(null)
        ).subscribe((data: [string, FilterOperation]) => {
            const [param, op] = data;

            // Calculate the new input type based on the chosen column (param)
            // and filter operation (op).
            const inputType = this.determineInputType(param, op);
            if ((this.inputType !== 'datetime' && inputType === 'datetime')) {
                // If going from a non-datetime input to a datetime input, clear
                // the current value so we don't get an error
                this.group.patchValue({ value: '' });
            } else if (inputType === 'none') {
                // Only used when 'Is Null' or 'Is Not Null' is selected
                this.group.patchValue({ value: 'null' });
            }
            this.inputType = inputType;
        });
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
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

    /**
     * Tries to determine the best input type to use based on the given column
     * and filter operation.
     */
    private determineInputType(col: string, op: FilterOperation): InputType {
        // For now we're assuming that the 'is' or 'isnot' input types are only
        // being applied to null values.
        if (op === 'is' || op === 'isnot') {
            return 'none';
        }

        const header = this.headers.find((h) => h.name === col);
        if (header === undefined)
            return 'normal';

        switch (header.type) {
            case 'datetime':
                return 'datetime';
            default:
                return 'normal';
        }
    }
}
