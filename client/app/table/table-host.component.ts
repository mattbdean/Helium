
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { TableService } from './table.service';

@Component({
    templateUrl: 'table-host.component.html',
    styleUrls: ['table-host.component.scss']
})
export class TableHostComponent implements OnInit {
    public tables: string[];
    public selectedTable: string;

    public constructor(
        private route: ActivatedRoute,
        private backend: TableService
    ) {}

    public async ngOnInit() {
        this.route.params.subscribe((params: Params) => {
            this.selectedTable = params.name;
        });
        this.tables = await this.backend.list();
    }
}
