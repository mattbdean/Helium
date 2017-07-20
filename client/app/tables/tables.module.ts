import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MdIconModule, MdProgressBarModule } from '@angular/material';

import { CoreModule } from '../core/core.module';
import { DatatableComponent } from './datatable.component';
import { TableHostComponent } from './table-host.component';
import { TableRoutingModule } from './table-routing.module';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import '@swimlane/ngx-datatable/release/assets/icons.css';
import '@swimlane/ngx-datatable/release/index.css';
import '@swimlane/ngx-datatable/release/themes/material.css';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MdIconModule,
        MdProgressBarModule,
        NgxDatatableModule,
        ReactiveFormsModule,
        TableRoutingModule
    ],
    declarations: [
        DatatableComponent,
        TableHostComponent
    ]
})
export class TablesModule {}
