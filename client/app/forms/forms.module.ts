import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MdCardModule } from '@angular/material';

import { DynamicFormModule } from '../dynamic-form/dynamic-form.module';
import { FormHostComponent } from './form-host.component';
import { FormRoutingModule } from './forms-routing.module';

@NgModule({
    imports: [
        CommonModule,
        DynamicFormModule,
        MdCardModule,
        FormRoutingModule
    ],
    declarations: [
        FormHostComponent
    ]
})
export class FormsModule {}
