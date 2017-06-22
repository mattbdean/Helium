import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MdButtonModule, MdSelectModule } from '@angular/material';

import { DynamicFormComponent } from './dynamic-form.component';

import { DynamicFieldDirective } from './components/dynamic-field/dynamic-field.directive';
import { FormButtonComponent } from './components/form-button/form-button.component';
import { FormInputComponent } from './components/form-input/form-input.component';
import { FormSelectComponent } from './components/form-select/form-select.component';

@NgModule({
    imports: [
        CommonModule,
        MdButtonModule,
        MdSelectModule,
        ReactiveFormsModule
    ],
    declarations: [
        DynamicFormComponent,
        DynamicFieldDirective,
        FormButtonComponent,
        FormInputComponent,
        FormSelectComponent
    ],
    exports: [
        DynamicFormComponent
    ],
    entryComponents: [
        FormButtonComponent,
        FormInputComponent,
        FormSelectComponent
    ]
})
export class DynamicFormModule {}
