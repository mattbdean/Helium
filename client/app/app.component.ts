import { Component, OnInit } from '@angular/core';
import { TableService } from "./core/table.service";

@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
    public tables: string[];
    public selectedTable: string;

    public constructor(
        private backend: TableService
    ) {}

    public async ngOnInit() {
        this.tables = await this.backend.list();
    }
}
