import { Component, OnInit } from '@angular/core';

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

    constructor(private backend: TableService) {}

    public async ngOnInit(): Promise<void> {
        this.name = (await this.backend.list())[5];
        this.headers = await this.backend.headers(this.name);
        this.content = this.arrangeByOrdinalPos(await this.backend.content(this.name), this.headers);
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
