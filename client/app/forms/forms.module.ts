import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import {
    MatButtonModule, MatCardModule, MatDialogModule, MatIconModule
} from '@angular/material';
import { CoreModule } from '../core/core.module';
import { DynamicFormsModule } from '../dynamic-forms/dynamic-forms.module';
import { FormSpecGeneratorService } from '../dynamic-forms/form-spec-generator/form-spec-generator.service';
import { TablesModule } from '../tables/tables.module';
import { FormHostComponent } from './form-host/form-host.component';
import { FormRoutingModule } from './forms-routing.module';
import { PartialFormComponent } from './partial-form/partial-form.component';
import { RowPickerDialogComponent } from './row-picker-dialog/row-picker-dialog.component';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        DynamicFormsModule,
        MatCardModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        ReactiveFormsModule,
        TablesModule,

        FormRoutingModule
    ],
    declarations: [
        PartialFormComponent,
        FormHostComponent,
        RowPickerDialogComponent
    ],
    entryComponents: [
        RowPickerDialogComponent
    ],
    providers: [
        FormSpecGeneratorService
    ]
})
export class FormsModule {}
