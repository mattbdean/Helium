import { Injectable } from '@angular/core';
import { EnumeratedControlComponent } from './controls/enumerated-control.component';
import { InputControlComponent } from './controls/input-control.component';
import { FormControlType } from './form-control-spec.interface';

/**
 * Maps FormControlTypes to component types. Exists as a service instead of a
 * function primarily for testing purposes.
 */
@Injectable()
export class ComponentMapperService {
    public componentFor(type: FormControlType) {
        switch (type) {
            case 'text':
                return InputControlComponent;
            case 'enum':
                return EnumeratedControlComponent;
            default:
                throw new Error('No known component for type ' + type);
        }
    }
}
