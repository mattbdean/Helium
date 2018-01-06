import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatCardModule, MatCheckboxModule, MatFormFieldModule, MatIconModule,
    MatInputModule,
    MatProgressBarModule, MatSelectModule, MatSnackBarModule
} from '@angular/material';

import { CoreModule } from '../core/core.module';
import { DatatableComponent } from './datatable/datatable.component';
import { TableHostComponent } from './table-host/table-host.component';
import { TableRoutingModule } from './table-routing.module';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { FilterManagerComponent } from './filter-manager/filter-manager.component';
import { FilterComponent } from './filter/filter.component';
import { FilterProviderService } from './filter-provider/filter-provider.service';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MatCardModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        NgxDatatableModule,
        ReactiveFormsModule,
        TableRoutingModule
    ],
    declarations: [
        DatatableComponent,
        FilterComponent,
        FilterManagerComponent,
        TableHostComponent
    ],
    providers: [
        FilterProviderService
    ]
})
export class TablesModule {}
