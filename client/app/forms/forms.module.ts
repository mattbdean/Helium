import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import {
    MatButtonModule, MatCardModule,
    MatIconModule
} from '@angular/material';
import { CoreModule } from '../core/core.module';
import { DynamicFormsModule } from '../dynamic-forms/dynamic-forms.module';
import { FormHostComponent } from './form-host/form-host.component';
import { FormSpecGeneratorService } from './form-spec-generator/form-spec-generator.service';
import { FormRoutingModule } from './forms-routing.module';
import { PartialFormComponent } from './partial-form/partial-form.component';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        DynamicFormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        ReactiveFormsModule,

        FormRoutingModule
    ],
    declarations: [
        PartialFormComponent,
        FormHostComponent,
    ],
    providers: [
        FormSpecGeneratorService
    ]
})
export class FormsModule {}
