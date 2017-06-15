import { Component, OnInit } from '@angular/core';

import { TableHeader } from '../common/responses';
import { TableService } from '../core/table.service';

@Component({
    selector: 'dynamic-form',
    templateUrl: 'dynamic-form.component.html',
    styleUrls: ['dynamic-form.component.scss']
})
export class DynamicFormComponent implements OnInit {
    private headers: TableHeader[];

    public constructor(
        private backend: TableService
    ) {}

    public async ngOnInit() {
        const tables = await this.backend.list();
        this.headers = (await this.backend.meta(tables[0])).headers;
    }
}
