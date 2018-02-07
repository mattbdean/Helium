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
    MatSelectModule,
    MatSnackBarModule
} from '@angular/material';
import { CoreModule } from '../core/core.module';
import { ComponentMapperService } from './component-mapper/component-mapper.service';
import { AutocompleteControlComponent } from './controls/autocomplete-control.component';
import { CheckboxControlComponent } from './controls/checkbox-control.component';
import { DateControlComponent } from './controls/date-control.component';
import { DatetimeControlWrapperComponent } from './controls/datetime-control.component';
import { EnumeratedControlComponent } from './controls/enumerated-control.component';
import { InputControlComponent } from './controls/input-control.component';
import { DynamicFormControlDirective } from './dynamic-form-control.directive';
import { FormSpecGeneratorService } from './form-spec-generator/form-spec-generator.service';

const formControlComponents = [
    AutocompleteControlComponent,
    CheckboxControlComponent,
    DateControlComponent,
    DatetimeControlWrapperComponent,
    EnumeratedControlComponent,
    InputControlComponent
];

/**
 * The DynamicFormsModule is dedicated to precisely that: dynamic forms. Based
 * on the given specification, this module can generate a different control to
 * be inserted into a reactive form.
 *
 * To get started import this module into the target module, then create a
 * FormControlSpec.
 *
 * ```ts
 * public spec: FormControlSpec = {
 *     type: 'text',
 *     formControlName: 'myControl',
 *     placeholder: 'My Control',
 *     ...
 * }
 * ```
 *
 * Create a FormGroup in the component that matches the shape of the desired
 * form.
 *
 * ```ts
 * public ngOnInit() {
 *     this.formGroup = new FormGroup({
 *         // Notice how spec.formControlName is the same as the key here
 *         myControl: new FormControl(...)
 *     });
 * }
 * ```
 *
 * Finally add this somewhere in your template:
 *
 * ```ts
 * <ng-template dynamicFormControl [group]="formGroup" [control]="spec"></ng-template>
 * ```
 *
 * The dynamicFormControl module will create a component based on the given
 * specification and register that component to the FormGroup.
 */
@NgModule({
    declarations: [
        ...formControlComponents,
        DynamicFormControlDirective
    ],
    imports: [
        CoreModule,
        CommonModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        ReactiveFormsModule
    ],
    exports: [
        DynamicFormControlDirective
    ],
    providers: [
        ComponentMapperService,
        FormSpecGeneratorService
    ],
    // The only components we need to insert dynamically are the form control
    // components.
    entryComponents: formControlComponents,
})
export class DynamicFormsModule {
}
