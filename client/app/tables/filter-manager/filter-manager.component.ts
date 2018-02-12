import {
    Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output,
    SimpleChanges
} from '@angular/core';
import {
    AbstractControl, FormArray, FormControl, FormGroup,
    Validators
} from '@angular/forms';
import { isEqual } from 'lodash';
import { Subscription } from 'rxjs/Subscription';
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

    private sub: Subscription;

    public ngOnInit() {
        this.formArray = new FormArray([]);
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.meta) {
            // The headers have changed (most likely because the user has
            // switched tables), start over
            this.formArray = new FormArray([]);

            if (!changes.meta.firstChange) {
                // User has switched tables, clear the filters
                this.sub.unsubscribe();
                this.changed.emit([]);
            }

            this.sub = this.formArray.valueChanges
                .distinctUntilChanged(isEqual)
                .map(() => {
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
                })
                .distinctUntilChanged(isEqual)
                .do((it) => { console.log('formArray.valueChanges', it, this.formArray.errors); })
                // Notify listeners that the filters have changed
                .subscribe((filters) => this.changed.emit(filters));
        }
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public addFilter() {
        this.formArray.push(FilterManagerComponent.createFilterGroup());
    }

    public removeFilter(control: AbstractControl) {
        // Remove the given array. FormArray doesn't have a
        // remove(AbstractControl) method so this'll work as long as we can
        // compare controls by ===
        this.formArray.removeAt(this.formArray.controls.findIndex((c) => c === control));
    }

    public static createFilterGroup() {
        return new FormGroup({
            param: new FormControl('', Validators.required),
            op: new FormControl('', Validators.required),
            value: new FormControl('', Validators.required)
        });

    }
}
