import { Component, OnInit } from '@angular/core';
import { Response } from '@angular/http';
import { ActivatedRoute, Params } from '@angular/router';

import * as _ from 'lodash';

import { SqlRow, TableHeader } from '../common/responses';
import { TableService } from './table.service';

interface DataTableHeader {
    name: string;
    prop: string;
}

@Component({
    selector: 'home',
    templateUrl: 'table.component.html'
})
export class TableComponent implements OnInit {
    private name: string;
    private headers: DataTableHeader[];
    private content: SqlRow[];
    private exists: boolean = true;

    constructor(
        private backend: TableService,
        private route: ActivatedRoute
    ) {}

    public ngOnInit(): void {
        this.route.params.subscribe(async (params: Params) => {
            this.name = params.name;

            try {
                const meta = await this.backend.meta(this.name);
                this.headers = this.createTableHeaders(meta.headers);
                this.content = await this.backend.content(this.name);
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

    private createTableHeaders(headers: TableHeader[]): DataTableHeader[] {
        return _.sortBy(_.map(headers, (h) => ({ name: h.name, prop: h.name })), 'ordinalPosition');
    }
}
