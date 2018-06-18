import {
    Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output,
    SimpleChanges
} from '@angular/core';
import {
    AbstractControl, FormArray, FormControl, FormGroup,
    Validators
} from '@angular/forms';
import { isEqual } from 'lodash';
import { Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Filter, TableMeta } from '../../common/api';

@Component({
    selector: 'filter-manager',
    templateUrl: 'filter-manager.component.html',
    styleUrls: ['filter-manager.component.scss']
})
export class FilterManagerComponent implements OnInit, OnChanges, OnDestroy {
    /**
     * A list of all headers being shown. Passed directly to FilterComponent
     * children.
     */
    @Input()
    public meta: TableMeta;

    /** Emits the valid filters when they've changed */
    @Output()
    public changed = new EventEmitter<Filter[]>();

    /** The number of filters being shown to the user */
    public get visibleFilters() { return this.formArray.length; }

    /** The root of this form */
    public formArray: FormArray;

    public preemptiveFilters: {
        schema: string,
        table: string,
        filters: Filter[]
    } | null = null;

    private sub: Subscription | null = null;

    public ngOnInit() {
        this.formArray = new FormArray([]);
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.meta && changes.meta.currentValue) {
            // The headers have changed (most likely because the user has
            // switched tables), start over
            this.formArray = new FormArray([]);

            // Re-create this subscription
            if (this.sub !== null) {
                this.sub.unsubscribe();
            }

            // User has switched tables, clear the filters
            this.changed.emit(this.applyPreemptiveFilters());

            this.sub = this.formArray.valueChanges.pipe(
                distinctUntilChanged(isEqual),
                map(() => {
                    return this.formArray.controls
                        // Only use data that is both valid and enabled
                        .filter((group: FormGroup) => {
                            // Filter out invalid and disabled filters
                            if (!group.valid) return false;

                            // Because of the way disabling works
                            for (const controlName of Object.keys(group.controls)) {
                                if (group.controls[controlName].disabled)
                                    return false;
                            }

                            return true;
                        })
                        .map((control) => control.value);
                }),
                distinctUntilChanged(isEqual)
            ).subscribe((filters) => 
                // Notify listeners that the filters have changed
                this.changed.emit(filters)
            );
                
        }
    }

    public ngOnDestroy() {
        if (this.sub !== null)
            this.sub.unsubscribe();
    }

    public addFilter(data?: Filter) {
        this.formArray.push(FilterManagerComponent.createFilterGroup(data));
    }

    public removeFilter(control: AbstractControl) {
        // Remove the given array. FormArray doesn't have a
        // remove(AbstractControl) method so this'll work as long as we can
        // compare controls by ===
        this.formArray.removeAt(this.formArray.controls.findIndex((c) => c === control));
    }

    private applyPreemptiveFilters(): Filter[] {
        if (this.preemptiveFilters === null ||
            this.preemptiveFilters.schema !== this.meta.schema ||
            this.preemptiveFilters.table !== this.meta.name)
            return [];

        for (const filter of this.preemptiveFilters.filters) {
            this.addFilter(filter);
        }

        const newFilters = this.preemptiveFilters.filters;
        this.preemptiveFilters = null;
        return newFilters;
    }

    public static createFilterGroup(data?: Filter) {
        return new FormGroup({
            param: new FormControl(data ? data.param : '', Validators.required),
            op: new FormControl(data ? data.op : '', Validators.required),
            value: new FormControl(data ? data.value : '', Validators.required)
        });
    }
}
