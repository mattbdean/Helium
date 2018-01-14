import {
    Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output,
    SimpleChanges
} from '@angular/core';
import {
    AbstractControl, FormArray, FormControl, FormGroup,
    Validators
} from '@angular/forms';
import { Subscription } from 'rxjs/Subscription';
import { Filter, TableHeader } from '../../common/api';

@Component({
    selector: 'filter-manager',
    templateUrl: 'filter-manager.component.html',
    styleUrls: ['filter-manager.component.scss']
})
export class FilterManagerComponent implements OnInit, OnChanges, OnDestroy {
    @Input()
    public headers: TableHeader[] = [];

    @Output()
    public changed = new EventEmitter<Filter[]>();

    public get visibleFilters() { return this.formArray.length; }

    public formArray: FormArray;

    private sub: Subscription;

    public ngOnInit() {
        this.formArray = new FormArray([]);
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.headers) {
            // The headers have changed (most likely because the user has
            // switched tables), start over
            this.formArray = new FormArray([]);

            if (!changes.headers.firstChange) {
                // User has switched tables, clear the filters
                this.sub.unsubscribe();
                this.changed.emit([]);
            }

            this.sub = this.formArray.valueChanges
                .map(() => {
                    return this.formArray.controls
                        // Only use data that is both valid and enabled
                        .filter((control) => control.valid && control.enabled)
                        .map((control) => control.value);
                })
                // Notify listeners that the filters have changed
                .subscribe((filters) => this.changed.emit(filters));
        }
    }

    public ngOnDestroy() {
        this.sub.unsubscribe();
    }

    public addFilter() {
        this.formArray.push(new FormGroup({
            param: new FormControl('', Validators.required),
            op: new FormControl('', Validators.required),
            value: new FormControl('', Validators.required)
        }));
    }

    public removeFilter(control: AbstractControl) {
        // Remove the given array. FormArray doesn't have a
        // remove(AbstractControl) method so this'll work as long as we can
        // compare controls by ===
        this.formArray.removeAt(this.formArray.controls.findIndex((c) => c === control));
    }
}
