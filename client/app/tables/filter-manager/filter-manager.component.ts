import {
    Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output,
    SimpleChanges
} from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Filter, TableHeader } from '../../common/api';
import { Subscription } from 'rxjs/Subscription';

@Component({
    selector: 'filter-manager',
    templateUrl: 'filter-manager.component.html'
})
export class FilterManagerComponent implements OnInit, OnChanges, OnDestroy {
    @Input()
    public headers: TableHeader[] = [];

    @Output()
    public changed = new EventEmitter<Filter>();

    private formArray: FormArray;

    private sub: Subscription;

    public ngOnInit() {
        this.formArray = new FormArray([]);
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes.headers) {
            // The headers have changed (most likely because the user has
            // switched tables), start over
            this.formArray = new FormArray([]);
            this.addFilter();
            this.sub = this.formArray.valueChanges
                .filter(() => this.formArray.valid)
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
}
