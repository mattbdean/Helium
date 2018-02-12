import { Injectable, Type } from '@angular/core';
import { AutocompleteControlComponent } from '../controls/autocomplete-control.component';
import { CheckboxControlComponent } from '../controls/checkbox-control.component';
import { DateControlComponent } from '../controls/date-control.component';
import { DatetimeControlWrapperComponent } from '../controls/datetime-control.component';
import { EnumeratedControlComponent } from '../controls/enumerated-control.component';
import { InputControlComponent } from '../controls/input-control.component';
import { FormControlType } from '../form-control-spec';

/**
 * Maps FormControlTypes to component types. Exists as a service instead of a
 * function primarily for testing purposes.
 */
@Injectable()
export class ComponentMapperService {
    public componentFor(type: FormControlType): Type<any> {
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
                return DateControlComponent;
            case 'datetime':
                return DatetimeControlWrapperComponent;
            default:
                throw new Error('No known component for type ' + type);
        }
    }
}
