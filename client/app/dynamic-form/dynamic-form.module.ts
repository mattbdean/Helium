import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DynamicFormRoutingModule } from './dynamic-form-routing.module';
import { DynamicFormComponent } from './dynamic-form.component';

@NgModule({
    imports: [
        CommonModule,
        DynamicFormRoutingModule
    ],
    declarations: [
        DynamicFormComponent
    ]
})
export class DynamicFormModule {}
