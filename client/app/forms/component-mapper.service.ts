import { Injectable } from '@angular/core';
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
            default:
                throw new Error('No known component for type ' + type);
        }
    }
}
