import {
    Component, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { Router } from '@angular/router';

import * as _ from 'lodash';
import { Observable } from 'rxjs/Rx';

import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { MatSidenav } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';
import { MasterTableName, TableTier } from './common/api';
import { unflattenTableNames } from './common/util';
import { AuthService } from './core/auth.service';
import { TableService } from './core/table.service';

interface GroupedName { tier: TableTier; names: MasterTableName[]; }

interface SchemaInfo { availableSchemas: string[]; selectedSchema: string; }

@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnDestroy, OnInit {
    public static readonly TIER_ORDER: TableTier[] =
        ['manual', 'lookup', 'imported', 'computed', 'hidden'];

    /**
     * If the width of the browser (in pixels) is above this value, the sidenav
     * will always be shown.
     */
    public static readonly ALWAYS_SHOW_SIDENAV_WIDTH = 1480;

    public groupedNames: GroupedName[];

    public schemas: string[] = [];

    private adjustSidenavSub: Subscription;
    public formGroup: FormGroup;
    public schemaControl: AbstractControl;

    @ViewChild(MatSidenav)
    private sidenav: MatSidenav;

    public sidenavMode: 'push' | 'over' | 'side' = 'side';

    public constructor(
        public auth: AuthService,
        private backend: TableService,
        private router: Router
    ) {}

    public ngOnInit() {
        // Fetch available schemas when the user logs in
        const schemas$: Observable<string[] | null> = this.auth.watchAuthState()
            .switchMap((isLoggedIn) => {
                if (isLoggedIn) {
                    return this.backend.schemas();
                } else {
                    return Observable.of(null);
                }
            });

        // Use a form group and <form> element so we can more easily update and
        // read the selected schema
        this.formGroup = new FormGroup({
            schemaSelect: new FormControl()
        });

        this.schemaControl = this.formGroup.get('schemaSelect');
        const selectedSchema$ = this.schemaControl.valueChanges;

        const schemaInfo$: Observable<SchemaInfo | null> = Observable.combineLatest(
            schemas$,
            selectedSchema$
        ).filter((data: [string[] | null, string | null]) => {
            // data[0] is an array of available schemas, data[1] is the
            // currently selected schema. Only emit data when both are non-null
            // or both are null. The only time one of these is null is when the
            // user logs out, and is immediately followed by more data coming
            // through the observable
            return (data[0] !== null) === (data[1] !== null);
        })
            .map((data: [string[] | null, string | null]) => {
                // Break the nested array structure up into an object. When both
                // elements are null, simply return null.
                if (data[0] === null || data[1] === null)
                    return null;
                return { availableSchemas: data[0], selectedSchema: data[1] };
            });

        schemaInfo$
            .switchMap((info: SchemaInfo | null) => {
                if (info === null)
                    return Observable.of([]);
                else
                    return this.backend.tables(info.selectedSchema);
            }).map(unflattenTableNames)
            // Start with an empty array so the template has something to do
            // before we get actual data
            .startWith([])
            .map((names: MasterTableName[]) => {
                return _(names)
                    .groupBy((n) => n.tier)
                    .map((value: MasterTableName[], key: TableTier): GroupedName => ({
                        tier: key,
                        names: value
                    }))
                    .sortBy((gn: GroupedName) => {
                        const position = AppComponent.TIER_ORDER.indexOf(gn.tier);
                        if (position < 0)
                            throw new Error('unexpected tier: ' + gn.tier);
                        return position;
                    })
                    .value();
            })
            // Usually I'd prefer to use the AsyncPipe but for whatever reason
            // I can't get it to subscribe during testing
            .subscribe((names) => { this.groupedNames = names; });

        // Listen for the user logging in and automatically select a schema for
        // them
        schemas$.subscribe((schemas) => {
            if (schemas !== null && this.schemaControl.value === null)
                this.schemaControl.setValue(this.determineDefaultSchema(schemas));
            this.schemas = schemas;
        });

        const windowResize$ = Observable
            .fromEvent(window, 'resize')
            // Start with a value so adjustSidenav gets called on init
            .startWith(-1);

        // When the window is resized or the user logs in or out, adjust the
        // sidenav.
        this.adjustSidenavSub = Observable.merge(windowResize$, this.auth.watchAuthState())
            .subscribe(() => { this.adjustSidenav(); });
    }

    public ngOnDestroy() {
        this.adjustSidenavSub.unsubscribe();
    }

    public onSidenavLinkClicked() {
        if (this.sidenavMode !== 'side')
            this.sidenav.opened = false;
    }

    public toggleSidenav() {
        this.sidenav.opened = !this.sidenav.opened;
    }

    public logout() {
        // Log the user out
        this.auth.logout();

        // We don't know if the next user will have access to the selected
        // schema
        this.schemaControl.reset();

        // Automatically redirect to the login page
        return this.router.navigate(['/login']);
    }

    private adjustSidenav() {
        if (!this.auth.loggedIn) {
            this.sidenav.opened = false;
        } else {
            const alwaysShow = window.innerWidth >= AppComponent.ALWAYS_SHOW_SIDENAV_WIDTH;
            this.sidenavMode = alwaysShow ? 'side' : 'over';
            this.sidenav.opened = alwaysShow;
        }
    }

    /**
     * Tries to determine the best schema to select by default. If the current
     * URL indicates a schema, that is selected if available. Otherwise, the
     * first schema that appears alphabetically is chosen. `information_schema`
     * will never be chosen unless it's the only schema.
     * @param {string[]} all A list of all schemas available to the user
     */
    private determineDefaultSchema(all: string[]) {
        const urlTree = this.router.parseUrl(this.router.url);
        // Get each segment of the URL. If the path is /foo/bar/baz, segments
        // will be ['foo', 'bar', 'baz'].
        const segments = urlTree.root.children.primary.segments.map((s) => s.path);

        if (segments.length > 1 && (segments[0] === 'tables' || segments[0] === 'forms')) {
            // The URL indicates a selected schema, pick it if the user has
            // access to it.
            const loadedSchema = segments[1];
            if (all.includes(loadedSchema)) {
                return loadedSchema;
            }
        }

        const sorted = _.sortBy(all);

        // Use the first schema when sorted alphabetically. Prefer not to use
        // information_schema since most users probably don't care about this
        if (sorted[0].toLocaleLowerCase() === 'information_schema' && sorted.length > 0)
            return sorted[1];
        return sorted[0];
    }
}
