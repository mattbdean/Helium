import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
    MdCardModule, MdInputModule,
    MdSnackBarModule
} from '@angular/material';

import { ReactiveFormsModule } from '@angular/forms';
import { CoreModule } from "../core/core.module";
import { DynamicFormControlDirective } from './dynamic-form-control.directive';
import { FormHostComponent } from './form-host.component';
import { FormRoutingModule } from './forms-routing.module';
import { InputControlComponent } from './input-control.component';
import { FormSpecGeneratorService } from './form-spec-generator.service';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MdCardModule,
        MdInputModule,
        MdSnackBarModule,
        ReactiveFormsModule,

        FormRoutingModule
    ],
    declarations: [
        DynamicFormControlDirective,
        FormHostComponent,
        InputControlComponent
    ],
    providers: [
        FormSpecGeneratorService
    ],
    entryComponents: [
        InputControlComponent
    ]
})
export class FormsModule {}
