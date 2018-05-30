import { expect } from 'chai';
import { AutocompleteControlComponent } from '../controls/autocomplete-control.component';
import { CheckboxControlComponent } from '../controls/checkbox-control.component';
import { DateControlComponent } from '../controls/date-control.component';
import { DatetimeControlWrapperComponent } from '../controls/datetime-control.component';
import { EnumeratedControlComponent } from '../controls/enumerated-control.component';
import { InputControlComponent } from '../controls/input-control.component';
import { FormControlType } from '../form-control-spec';
import { ComponentMapperService } from './component-mapper.service';

describe('ComponentMapperService', () => {
    let mapper: ComponentMapperService;

    beforeEach(() => {
        mapper = new ComponentMapperService();
    });

    describe('componentFor', () => {
        it('should recognize basic types', () => {
            const expected: { [key: string]: any } = {
                autocomplete: AutocompleteControlComponent,
                boolean: CheckboxControlComponent,
                enum: EnumeratedControlComponent,
                text: InputControlComponent,
                date: DateControlComponent,
                datetime: DatetimeControlWrapperComponent
            };

            for (const type of Object.keys(expected)) {
                expect(mapper.componentFor(type as FormControlType)).to.equal(expected[type]);
            }
        });

        it('should throw an error on unrecognized types', () => {
            expect(() => mapper.componentFor('foo' as FormControlType)).to.throw(Error);
        });
    });
});
