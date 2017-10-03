import { Injectable } from '@angular/core';
import { EnumeratedControlComponent } from './controls/enumerated-control.component';
import { InputControlComponent } from './controls/input-control.component';
import { FormControlType } from './form-control-spec.interface';
import { CheckboxControlComponent } from './controls/checkbox-control.component';
import { DateTimeControlComponent } from './controls/date-time-control.component';
import { AutocompleteControlComponent } from './controls/autocomplete-control.component';

/**
 * Maps FormControlTypes to component types. Exists as a service instead of a
 * function primarily for testing purposes.
 */
@Injectable()
export class ComponentMapperService {
    public componentFor(type: FormControlType) {
        switch (type) {
            case 'autocomplete':
                return AutocompleteControlComponent;
            case 'text':
                return InputControlComponent;
            case 'enum':
                return EnumeratedControlComponent;
            case 'boolean':
                return CheckboxControlComponent;
            case 'date':
                return DateTimeControlComponent;
            default:
                throw new Error('No known component for type ' + type);
        }
    }
}
