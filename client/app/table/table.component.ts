import { Component, OnInit } from '@angular/core';
import { Response } from '@angular/http';
import { ActivatedRoute, Params, Router } from '@angular/router';

import * as _ from 'lodash';

import { SqlRow, SqlTableHeader } from '../common/responses';
import { TableService } from './table.service';

@Component({
    selector: 'home',
    templateUrl: 'table.component.html'
})
export class TableComponent implements OnInit {
    private name: string;
    private headers: SqlTableHeader[];
    private content: any[];
    private exists: boolean = true;

    constructor(
        private backend: TableService,
        private route: ActivatedRoute
    ) {}

    public async ngOnInit(): Promise<void> {
        this.route.params
            .subscribe(async (params: Params) => {
                const name = params.name;

                try {
                    this.headers = await this.backend.headers(name);
                    this.content = this.arrangeByOrdinalPos(await this.backend.content(name), this.headers);
                    this.name = name;
                } catch (e) {
                    // Handle 404s, show the user that the table couldn't be found
                    if (e instanceof Response && e.status === 404) {
                        this.exists = false;
                        return;
                    }

                    // Other error, rethrow it
                    throw e;
                }
            });
    }

    private arrangeByOrdinalPos(content: SqlRow[], headers: SqlTableHeader[]): any[] {
        const positions = _.zipObject(
            _.map(headers, 'name'),
            // ordinalPosition is 1-indexed, make it 0-indexed
            _.map(headers, (h) => h.ordinalPosition - 1)
        );

        return _.map(content, (row) => {
            const arr = [];
            for (const key of Object.keys(row)) {
                arr[positions[key]] = row[key];
            }
            return arr;
        });
    }
}
