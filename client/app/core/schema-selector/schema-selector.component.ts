import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { sortBy } from 'lodash';
import { Observable, of, Subscription } from 'rxjs';
import { distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

@Component({
    selector: 'schema-selector',
    templateUrl: 'schema-selector.component.html',
    styleUrls: ['schema-selector.component.scss']
})
export class SchemaSelectorComponent implements OnInit, OnDestroy {
    /**
     * Emits the name of a schema when the user chooses one and null when there
     * are no schemas to choose from. In practice, the latter only happens when
     * there is no authenticated user or in the rare occasion the user does not
     * have permission to know about any schemas in the database.
     */
    @Output()
    public schemaChange = new EventEmitter<string | null>();

    /**
     * Emits an array of available schema names whenever the user logs in and an
     * empty array when the user logs out
     */
    public schemas$: Observable<string[]>;

    /** The currently selected schema, or null if there is none */
    public get schema(): string | null {
        return this.formGroup.value.schemaSelect;
    }

    private formGroup: FormGroup;
    private copySub: Subscription;
    private updateSub: Subscription; 

    public constructor(
        private api: ApiService,
        private router: Router,
        private auth: AuthService
    ) {}

    public ngOnInit() {
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

        // Update the schema whenever the user logs in/out
        this.updateSub = this.schemas$.pipe(
            map((schemas) => this.defaultSchema(schemas))
        ).subscribe((defaultSchema) => {
            this.formGroup.setValue({ schemaSelect: defaultSchema });
        });

        this.copySub = this.formGroup.valueChanges.pipe(
            map((form) => form.schemaSelect),
            distinctUntilChanged()
        ).subscribe((schema: string | null) => {
            this.schemaChange.emit(schema);
        });
    }

    public ngOnDestroy() {
        if (this.copySub) this.copySub.unsubscribe();
        if (this.updateSub) this.updateSub.unsubscribe();
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
        if (segments.length > 1 && (segments[0] === 'tables' || segments[0] === 'forms' || segments[0] === 'erd')) {
            // The URL indicates a selected schema, pick it if the user has
            // access to it.
            const loadedSchema = segments[1];
            if (schemas.includes(loadedSchema)) {
                return loadedSchema;
            }
        }

        const sorted = sortBy(schemas);

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
        if (!urlTree.root.children.primary)
            return [];
        return urlTree.root.children.primary.segments.map((s) => s.path);
    }
}
