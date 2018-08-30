import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { TableName } from '../../common/table-name';
import { SidenavComponent } from '../../sidenav/sidenav.component';

@Component({
    templateUrl: 'table-host.component.html',
    styleUrls: ['table-host.component.scss']
})
export class TableHostComponent implements OnInit {
    public selectedTable: TableName | null;

    public constructor(
        private sidenav: SidenavComponent,
        public route: ActivatedRoute
    ) {}

    public ngOnInit(): void {
        this.route.params.subscribe((params: Params) => {
            // both /tables and /tables/:schema/:table route here, figure out if
            // we're provided data or not
            this.selectedTable = params.schema ? new TableName(params.schema, params.table) : null;

            if (this.selectedTable === null) {
                // Open the sidenav, manually ensure the sidenav is showable.
                this.sidenav.showable = true;
                this.sidenav.open();
            }
        });
    }
}
