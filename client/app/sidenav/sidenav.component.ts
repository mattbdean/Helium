import { AfterViewInit, Component, Input, OnDestroy, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material';
import * as _ from 'lodash';
import { Observable, of, Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { unflattenTableNames } from '../../../common/util';
import { MasterTableName, TableTier } from '../common/api';
import { ApiService } from '../core/api/api.service';
import { SchemaSelectorComponent } from '../core/schema-selector/schema-selector.component';

/**
 * The SidenavComponent handles navigation to all available schemas and tables,
 * and includes a "Report a Bug" button.
 */
@Component({
    selector: 'sidenav',
    templateUrl: 'sidenav.component.html',
    styleUrls: ['sidenav.component.scss']
})
export class SidenavComponent implements AfterViewInit, OnDestroy {
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
        return this.schemaSelector.schema;
    }

    @ViewChild(MatSidenav)
    private matSidenav: MatSidenav;

    @ViewChild(SchemaSelectorComponent)
    private schemaSelector: SchemaSelectorComponent;

    private schemasSub: Subscription | null = null;

    public constructor(
        private api: ApiService
    ) {}

    public ngAfterViewInit() {
        this.tables$ = this.schemaSelector.schemaChange.pipe(
            switchMap((schema: string | null) =>
                schema === null ? of([]) : this.api.tables(schema)),
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
}

interface GroupedName {
    tier: TableTier;
    names: MasterTableName[];
}

export type ToggleMode = 'toggleRequired' | 'alwaysDisplayed';
