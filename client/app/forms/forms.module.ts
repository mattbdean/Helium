import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSnackBarModule
} from '@angular/material';

import { CoreModule } from '../core/core.module';
import { ComponentMapperService } from './component-mapper/component-mapper.service';
import { AutocompleteControlComponent } from './dynamic-controls/autocomplete-control.component';
import { CheckboxControlComponent } from './dynamic-controls/checkbox-control.component';
import { DateControlComponent } from './dynamic-controls/date-control.component';
import { EnumeratedControlComponent } from './dynamic-controls/enumerated-control.component';
import { InputControlComponent } from './dynamic-controls/input-control.component';
import { DynamicFormControlDirective } from './dynamic-form-control.directive';
import { FormHostComponent } from './form-host/form-host.component';
import { FormSpecGeneratorService } from './form-spec-generator/form-spec-generator.service';
import { FormRoutingModule } from './forms-routing.module';
import { PartialFormComponent } from './partial-form/partial-form.component';
import { DatetimeControlWrapperComponent } from './dynamic-controls/datetime-control.component';

const formControlComponents = [
    AutocompleteControlComponent,
    CheckboxControlComponent,
    DateControlComponent,
    DatetimeControlWrapperComponent,
    EnumeratedControlComponent,
    InputControlComponent
];

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule,

        FormRoutingModule
    ],
    declarations: [
        DynamicFormControlDirective,
        PartialFormComponent,
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
