import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MdButtonModule, MdInputModule, MdSelectModule } from '@angular/material';

import { DynamicFormComponent } from './dynamic-form.component';

import { DynamicFieldDirective } from './components/dynamic-field/dynamic-field.directive';
import { FormInputComponent } from './components/form-input/form-input.component';
import { FormSelectComponent } from './components/form-select/form-select.component';
import { FormSubmitComponent } from './components/form-submit/form-submit.component';

@NgModule({
    imports: [
        CommonModule,
        MdButtonModule,
        MdInputModule,
        MdSelectModule,
        ReactiveFormsModule
    ],
    declarations: [
        DynamicFormComponent,
        DynamicFieldDirective,
        FormInputComponent,
        FormSelectComponent,
        FormSubmitComponent
    ],
    exports: [
        DynamicFormComponent
    ],
    entryComponents: [
        FormInputComponent,
        FormSelectComponent,
        FormSubmitComponent
    ]
})
export class DynamicFormModule {}
