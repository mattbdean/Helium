import {
    Component, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { Observable } from 'rxjs/Rx';

import * as _ from 'lodash';

import { MdSidenav } from '@angular/material';
import { Subscription } from 'rxjs/Subscription';
import { MasterTableName, TableTier } from './common/api';
import { unflattenTableNames } from './common/util';
import { TableService } from "./core/table.service";

interface GroupedName { tier: TableTier; names: MasterTableName[]; }

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

    public groupedNames: Observable<GroupedName[]>;

    private windowSizeSub: Subscription;

    @ViewChild(MdSidenav)
    private sidenav: MdSidenav;

    private sidenavMode: 'push' | 'over' | 'side' = 'side';
    private sidenavOpened: boolean = true;

    public constructor(
        private backend: TableService
    ) {}

    public ngOnInit() {
        this.groupedNames = this.backend.list()
            .map(unflattenTableNames)
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
            });

        this.windowSizeSub = Observable
            .fromEvent(window, 'resize')
            .subscribe(() => {
                this.adjustSidenav(window.innerWidth);
            });
    }

    public ngOnDestroy() {
        this.windowSizeSub.unsubscribe();
    }

    public toggleSidenav() {
        this.sidenavOpened = !this.sidenavOpened;
    }

    private adjustSidenav(windowWidth: number) {
        const alwaysShow = windowWidth >= AppComponent.ALWAYS_SHOW_SIDENAV_WIDTH;
        this.sidenavMode = alwaysShow ? 'side' : 'over';
        this.sidenavOpened = alwaysShow;
    }
}
