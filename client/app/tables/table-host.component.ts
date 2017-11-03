import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { TableName } from '../common/table-name';

@Component({
    templateUrl: 'table-host.component.html',
    styleUrls: ['table-host.component.scss']
})
export class TableHostComponent implements OnInit {
    public selectedTable: TableName;

    public constructor(public route: ActivatedRoute) {}

    public ngOnInit(): void {
        this.route.params.subscribe((params: Params) => {
            this.selectedTable = params.name ? new TableName(params.name) : null;
        });
    }
}
