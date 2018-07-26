import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSidenav } from '@angular/material';
import { Router } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, Observable, of, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, first, map, switchMap } from 'rxjs/operators';
import { unflattenTableNames } from '../../../common/util';
import { MasterTableName, TableTier } from '../common/api';
import { ApiService } from '../core/api/api.service';
import { AuthService } from '../core/auth/auth.service';

/**
 * The SidenavComponent handles navigation to all available schemas and tables,
 * and includes a "Report a Bug" button.
 */
@Component({
    selector: 'sidenav',
    templateUrl: 'sidenav.component.html',
    styleUrls: ['sidenav.component.scss']
})
export class SidenavComponent implements OnInit, OnDestroy {
    /**
     * The order in which tiers of tables are shown. Any tables whose tier
     * appears at index `n` will always come before tables whose tier appears at
     * index `n + 1`.
     */
    public static readonly TIER_ORDER: TableTier[] =
        ['manual', 'lookup', 'imported', 'computed', 'hidden', 'unknown'];

    private _showable: boolean = true;
    /** If false, the sidenav will not be able to be seen at all. */
    @Input()
    public set showable(val) {
        this._showable = !!val;

        if (!this._showable)
            this.matSidenav.close();
        
        if (this._showable && this.toggleMode === 'alwaysDisplayed')
            this.open();
    }
    public get showable() { return this._showable; }

    private _toggleMode: ToggleMode = 'toggleRequired';
    /**
     * If `toggleRequired`, the sidenav will be hidden by default and will have
     * to be opened/close manually in order to be shown. The sidenav will not
     * be shown by default. If `alwaysDisplayed`, the sidenav will always be
     * showing and will not be able to be closed.
     */
    @Input()
    public set toggleMode(val: ToggleMode) {
        this._toggleMode = val;
        if (val === 'alwaysDisplayed')
            this.open();
        else {
            this.close();
        }
    }
    public get toggleMode() { return this._toggleMode; }

    public get opened() { return this.matSidenav.opened; }

    /** The only member of this group is a MatSelect for choosing the schema. */
    public formGroup: FormGroup;

    /** Emits an array of schema names whenever the user logs in. */
    public schemas$: Observable<string[]>;

    /**
     * Emits an array of TableNames grouped by tier whenever the schema selector
     * is changed.
     */
    public tables$: Observable<GroupedName[]>;

    /**
     * The current MatSidenav mode in use. See MatSidenav's documentation
     * for more.
     */
    public get mode(): 'push' | 'over' | 'side' {
        return this.toggleMode === 'toggleRequired' ? 'over' : 'side';
    }

    public get disableClose(): boolean {
        return this.toggleMode === 'alwaysDisplayed';
    }

    public get schema(): string | null {
        return this.formGroup.value.schemaSelect;
    }

    @ViewChild(MatSidenav)
    private matSidenav: MatSidenav;

    private schemasSub: Subscription | null = null;

    public constructor(
        private auth: AuthService,
        private api: ApiService,
        private router: Router
    ) {}

    public ngOnInit() {
        this.auth.watchAuthState().subscribe(console.log);
        this.schemas$ = this.auth.watchAuthState().pipe(
            switchMap((isLoggedIn) => {
                return isLoggedIn ? this.api.schemas() : of([]);
            })
        );

        // Use a form group and <form> element so we can more easily update and
        // read the selected schema
        this.formGroup = new FormGroup({
            schemaSelect: new FormControl()
        });

        const selectedSchema$: Observable<string> = this.formGroup.valueChanges.pipe(
            map((form) => form.schemaSelect),
            // The schema may be null if there are no schemas available
            filter((schema) => schema !== null),
            distinctUntilChanged()
        );

        this.tables$ = combineLatest(this.auth.watchAuthState(), selectedSchema$).pipe(
            switchMap(([isLoggedIn, schema]) => {
                return isLoggedIn ? this.api.tables(schema) : of([]);
            }),
            // Group part tables with their master tables
            map(unflattenTableNames),
            map((names: MasterTableName[]) => {
                // Group each name by its tier
                return _(names)
                    .groupBy((n) => n.tier)
                    .map((value: MasterTableName[], key: TableTier): GroupedName => ({
                        tier: key,
                        names: value
                    }))
                    .sortBy((gn: GroupedName) => {
                        const position = SidenavComponent.TIER_ORDER.indexOf(gn.tier);
                        if (position < 0)
                            throw new Error('unexpected tier: ' + gn.tier);
                        return position;
                    })
                    .value();
            })
        );

        // Update the schema whenever the user logs in/out
        this.schemasSub = this.schemas$.pipe(
            map((schemas) => this.defaultSchema(schemas))
        ).subscribe((defaultSchema) => {
            this.formGroup.setValue({ schemaSelect: defaultSchema });
        });
    }

    public ngOnDestroy() {
        if (this.schemasSub)
            this.schemasSub.unsubscribe();
    }
    
    /**
     * Opens the sidenav. Does nothing if the sidenav is already opened or
     * `showable` is false.
     */
    public open() {
        if (!this.showable || this.matSidenav.opened)
            return;
        
        this.matSidenav.open();
    }

    /**
     * Closes the sidenav. Does nothing if `disableClose` is true or if already
     * closed.
     */
    public close() {
        if (this.disableClose || !this.matSidenav.opened)
            return;

        this.matSidenav.close();
    }

    /**
     * Calls `close()` if opened, or `open()` if closed.
     */
    public toggle() {
        (this.matSidenav.opened ? this.close : this.open).call(this);
    }

    /**
     * Tries to determine the best schema to select by default. If the current
     * URL indicates a schema, that is selected if available. Otherwise, the
     * first schema that appears alphabetically is chosen. `information_schema`
     * will never be chosen unless it's the only schema. Returns null if
     * there are no schemas provided.
     * 
     * @param {string[]} schema A list of all schemas available to the user
     */
    public defaultSchema(schemas: string[]): string | null {
        if (schemas.length === 0)
            return null;
        
        const segments = this.currentPath();
        if (segments.length > 1 && (segments[0] === 'tables' || segments[0] === 'forms')) {
            // The URL indicates a selected schema, pick it if the user has
            // access to it.
            const loadedSchema = segments[1];
            if (schemas.includes(loadedSchema)) {
                return loadedSchema;
            }
        }

        const sorted = _.sortBy(schemas);

        // Use the first schema when sorted alphabetically. Prefer not to use
        // information_schema since most users probably don't care about this
        const index = sorted[0].toLowerCase() === 'information_schema' && sorted.length > 1 ? 1 : 0;
        return sorted[index];
    }

    /**
     * Visible for testing purposes only.
     * 
     * Returns each segment of the current URL's path as an element of an array.
     * For example, if the path is `/foo/bar/baz`, this method will return
     * `['foo', 'bar', 'baz']`.
     */
    public currentPath(): string[] {
        const urlTree = this.router.parseUrl(this.router.url);
        return urlTree.root.children.primary.segments.map((s) => s.path);
    }
}

interface GroupedName {
    tier: TableTier;
    names: MasterTableName[];
}

export type ToggleMode = 'toggleRequired' | 'alwaysDisplayed';
