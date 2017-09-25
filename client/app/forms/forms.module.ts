import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
    MdButtonModule,
    MdCardModule, MdCheckboxModule, MdInputModule, MdSelectModule,
    MdSnackBarModule
} from '@angular/material';

import { ReactiveFormsModule } from '@angular/forms';
import { CoreModule } from "../core/core.module";
import { ComponentMapperService } from './component-mapper.service';
import { CheckboxControlComponent } from './controls/checkbox-control.component';
import { EnumeratedControlComponent } from './controls/enumerated-control.component';
import { InputControlComponent } from './controls/input-control.component';
import { DynamicFormControlDirective } from './dynamic-form-control.directive';
import { FormHostComponent } from './form-host.component';
import { FormSpecGeneratorService } from './form-spec-generator.service';
import { FormRoutingModule } from './forms-routing.module';

const formControlComponents = [
    CheckboxControlComponent,
    EnumeratedControlComponent,
    InputControlComponent
];

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MdButtonModule,
        MdCardModule,
        MdCheckboxModule,
        MdInputModule,
        MdSelectModule,
        MdSnackBarModule,
        ReactiveFormsModule,

        FormRoutingModule
    ],
    declarations: [
        DynamicFormControlDirective,
        FormHostComponent,
        ...formControlComponents
    ],
    providers: [
        ComponentMapperService,
        FormSpecGeneratorService
    ],
    // The only components we need to insert dynamically are the form control
    // components.
    entryComponents: formControlComponents
})
export class FormsModule {}
