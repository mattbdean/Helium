import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Rx';

import * as _ from 'lodash';

import { TableName, TableTier } from './common/api';
import { TableService } from "./core/table.service";

interface GroupedName { tier: TableTier; names: TableName[]; }

@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
    public static readonly TIER_ORDER: TableTier[] =
        ['manual', 'lookup', 'imported', 'computed', 'hidden'];

    public groupedNames: Observable<GroupedName[]>;

    public constructor(
        private backend: TableService
    ) {}

    public ngOnInit() {
        this.groupedNames = this.backend.list()
            // Start with an empty array so the template has something to do
            // before we get actual data
            .startWith([])
            .map((names: TableName[]) => {
                return _(names)
                    .groupBy((n) => n.tier)
                    .map((value: TableName[], key: TableTier): GroupedName => ({
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
    }
}
