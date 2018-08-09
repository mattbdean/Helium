import { AfterViewInit, Component, Input, OnChanges, QueryList, ViewChildren } from '@angular/core';
import { FormControl } from '@angular/forms';
import { combineLatest, Observable, zip } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap, tap } from 'rxjs/operators';
import { SqlRow, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { FormEntryComponent, FormEntrySnapshot } from '../form-entry/form-entry.component';

/**
 * A partial form handles zero or more form entries for a particular table. A
 * partial form has two distinct modes of operation, or "roles." The role of
 * 'master' will allow exactly one form entry. The role of 'part' allows zero
 * or more entries.
 */
@Component({
    selector: 'partial-form',
    templateUrl: 'partial-form.component.html',
    styleUrls: ['partial-form.component.scss']
})
export class PartialFormComponent implements OnChanges, AfterViewInit {
    @Input()
    public meta: TableMeta;

    /**
     * Determines how this component should handle adding and removing entries.
     * Master tables have exactly one entry that cannot be removed. Part tables
     * start with zero entries but can have (in theory) infinite.
     */
    @Input()
    public role: 'master' | 'part' = 'master';

    @Input()
    public initialData: SqlRow[] = [];

    /** Emits true when the form is now valid and false for the opposite. */
    public validityChange: Observable<boolean>;

    @ViewChildren(FormEntryComponent)
    public formEntries: QueryList<FormEntryComponent>;

    /** IDs for the form snapshots. `ids[i]` corresponds to `state[i]`. */
    public ids: string[] = [];

    /**
     * The latest snapshots from the form entries. A null value represents an
     * entry that has yet to report its first snapshot.
     */
    public state: Array<FormEntrySnapshot | null> = [];

    /** True if all form entries this component handles report as valid. */
    public get valid() {
        return this.state.find((s) => s === null || !s.valid) !== undefined;
    }

    /** The current value of this partial form */
    public get value(): SqlRow[] {
        return this.state.map((s) => s === null ? {} : s.value);
    }

    /** The name of the table as it would be presented in DataJoint */
    public get cleanName() {
        return this.meta ? new TableName('(unused)', this.meta.name).name.clean : '';
    }

    public ngOnChanges() {

        // Changes have been made after the view has been initialized, it's okay
        // to call this method here
        if (this.formEntries !== undefined) {
            this.propagateInitialForm();

            // Change to the TableMeta, role, or prefilled data. Either way, we're
            // going to have to fully reset.
            this.reset();
        }

        // Master tables have exactly 1 entry
        if (this.role === 'part') {
            // Part table. Add FormEntry for every prefilled entry we have
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < this.initialData.length; i++) {
                this.addEntry();
            }
        } else {
            this.addEntry();
        }
    }

    public ngAfterViewInit() {
        // Call this here so that we can be sure the QueryList is defined
        this.propagateInitialForm();

        const formEntryChanges$ = this.formEntries.changes.pipe(
            startWith(this.formEntries)
        );

        this.validityChange = formEntryChanges$.pipe(
            switchMap((ql: QueryList<FormEntryComponent>) => {
                return combineLatest(...ql.toArray().map((f) =>
                    f.group.statusChanges.pipe(
                        startWith(f.group.status)
                    )));
            }),
            map((validities: Array<'VALID' | 'INVALID' | 'PENDING' | 'DISABLED'>) => {
                return validities.find((v) => v !== 'VALID') === undefined;
            }),
            distinctUntilChanged(),
            // A form is initially valid if it's a part table because 0 entries
            // by default means nothing to validate
            startWith(this.role === 'part')
        );
    }

    public handleEntryChange(index: number, event: FormEntrySnapshot) {
        this.state[index] = event;
    }

    public addEntry() {
        this.ids.push(Math.random().toString(36));
        this.state.push(null);
    }

    public removeEntry(index: number) {
        this.ids.splice(index, 1);
        this.state.splice(index, 1);
    }

    public get(columnName: string, entryIndex: number): Observable<FormControl> {
        return this.getAll(columnName).pipe(
            map((formControls: FormControl[]) => {
                const control = formControls[entryIndex];
                if (control === undefined)
                    throw new Error('Invalid entry index: ' + entryIndex);
                
                return control;
            })
        );
    }

    public getAll(columnName: string): Observable<FormControl[]> {
        return this.formEntries.changes.pipe(
            startWith(this.formEntries),
            map((ql: QueryList<FormEntryComponent>) => {
                const formEntries = ql.toArray();

                const controls: FormControl[] = [];
                for (const formEntry of formEntries) {
                    const control = formEntry.group.get(columnName);

                    if (control === null)
                        throw new Error(`No such column: "${columnName}"`);

                    controls.push(control as FormControl);
                }
                
                return controls;
            })
        );
    }

    /**
     * Resets the form to its original state, as if the user was navigating to
     * the form for the first time. If role is 'part', then all entries will be
     * cleared. If role is 'master', the FormEntryComponent will simply be
     * cleared.
     */
    public reset() {
        if (this.role === 'part') {
            this.state = [];
            this.ids = [];
        } else {
            this.formEntries.toArray()[0].group.reset();
        }
    }

    private propagateInitialForm() {
        if (this.role === 'master' && this.initialData.length > 1)
            throw new Error('Master tables can have at most one prefilled ' +
                'entry, was given ' + this.initialData.length);
        else if (this.role === 'part' && this.initialData.length !== this.formEntries.length)
            throw new Error(`Expecting ${this.initialData.length} entries, ` +
                `got ${this.formEntries.length}`);
        
        const entries = this.formEntries.toArray();

        // Wait until next event loop cycle for change detection purposes
        setTimeout(() => {
            // Use initialData.length as upper bound because it will always be
            // equal to or less than the number of prefilled entries in case of
            // a master table role
            for (let i = 0; i < this.initialData.length; i++) {
                entries[i].patchValue(this.initialData[i]);
            }
        }, 0);
    }
}
