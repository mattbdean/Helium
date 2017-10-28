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
import { ComponentMapperService } from './component-mapper.service';
import { AutocompleteControlComponent } from './controls/autocomplete-control.component';
import { CheckboxControlComponent } from './controls/checkbox-control.component';
import { DateTimeControlComponent } from './controls/date-time-control.component';
import { EnumeratedControlComponent } from './controls/enumerated-control.component';
import { InputControlComponent } from './controls/input-control.component';
import { DynamicFormControlDirective } from './dynamic-form-control.directive';
import { FormHostComponent } from './form-host.component';
import { FormSpecGeneratorService } from './form-spec-generator.service';
import { FormRoutingModule } from './forms-routing.module';
import { PartialFormComponent } from './partial-form.component';

const formControlComponents = [
    AutocompleteControlComponent,
    CheckboxControlComponent,
    DateTimeControlComponent,
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
        MatNativeDateModule,
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
