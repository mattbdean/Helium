import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs/Rx';

import { TableService } from "./core/table.service";

@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnInit {
    private tables: Observable<string[]>;
    private selectedTable: string;

    public constructor(
        private backend: TableService
    ) {}

    public async ngOnInit() {
        this.tables = await this.backend.list();
    }
}
