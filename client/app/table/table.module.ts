import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { CoreModule } from '../core/core.module';
import { TableHostComponent } from './table-host.component';
import { TableRoutingModule } from './table-routing.module';
import { TableComponent } from './table.component';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import '@swimlane/ngx-datatable/release/assets/icons.css';
import '@swimlane/ngx-datatable/release/index.css';
import '@swimlane/ngx-datatable/release/themes/material.css';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        NgxDatatableModule,
        ReactiveFormsModule,
        TableRoutingModule
    ],
    declarations: [
        TableComponent,
        TableHostComponent
    ]
})
export class TableModule {}
