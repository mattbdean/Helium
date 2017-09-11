import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MdCardModule, MdSnackBarModule } from '@angular/material';

import { CoreModule } from "../core/core.module";
import { DynamicFormModule } from '../dynamic-form/dynamic-form.module';
import { FormHostComponent } from './form-host.component';
import { FormRoutingModule } from './forms-routing.module';
import { FormContainerComponent } from './form-container.component';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        DynamicFormModule,
        MdCardModule,
        MdSnackBarModule,
        FormRoutingModule
    ],
    declarations: [
        FormContainerComponent,
        FormHostComponent
    ]
})
export class FormsModule {}
