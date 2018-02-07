import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatButtonModule,
    MatCardModule, MatCheckboxModule, MatFormFieldModule, MatIconModule,
    MatProgressBarModule, MatSelectModule
} from '@angular/material';

import { CoreModule } from '../core/core.module';
import { DatatableComponent } from './datatable/datatable.component';
import { TableHostComponent } from './table-host/table-host.component';
import { TableRoutingModule } from './table-routing.module';

import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { InlineSVGModule } from 'ng-inline-svg';
import { DynamicFormsModule } from '../dynamic-forms/dynamic-forms.module';
import { FilterManagerComponent } from './filter-manager/filter-manager.component';
import { FilterProviderService } from './filter-provider/filter-provider.service';
import { FilterComponent } from './filter/filter.component';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        DynamicFormsModule,
        InlineSVGModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatProgressBarModule,
        MatSelectModule,
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
