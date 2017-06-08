import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';

import { CoreModule } from '../core/core.module';

import { TableRoutingModule } from './table-routing.module';
import { TableComponent } from './table.component';
import { TableService } from './table.service';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        HttpModule,
        ReactiveFormsModule,
        TableRoutingModule
    ],
    declarations: [
        TableComponent
    ],
    providers: [TableService]
})
export class TableModule {}
