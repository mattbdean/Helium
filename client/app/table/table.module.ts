import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { CoreModule } from '../core/core.module';

import { TableRoutingModule } from './table-routing.module';
import { TableComponent } from './table.component';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        ReactiveFormsModule,
        TableRoutingModule
    ],
    declarations: [
        TableComponent
    ]
})
export class TableModule {}
