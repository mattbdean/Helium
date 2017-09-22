import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MdCardModule, MdSnackBarModule } from '@angular/material';

import { CoreModule } from "../core/core.module";
import { FormRoutingModule } from './forms-routing.module';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MdCardModule,
        MdSnackBarModule,
        FormRoutingModule
    ],
    declarations: [
        // FormHostComponent
    ]
})
export class FormsModule {}
