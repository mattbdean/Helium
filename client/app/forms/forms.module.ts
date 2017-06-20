import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { DynamicFormComponent } from './dynamic-form.component';
import { FormRoutingModule } from './forms-routing.module';

@NgModule({
    imports: [
        CommonModule,
        FormRoutingModule
    ],
    declarations: [
        DynamicFormComponent
    ]
})
export class FormsModule {}
