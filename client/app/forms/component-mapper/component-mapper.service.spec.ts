
import { ComponentMapperService } from './component-mapper.service';
import { AutocompleteControlComponent } from '../dynamic-controls/autocomplete-control.component';
import { CheckboxControlComponent } from '../dynamic-controls/checkbox-control.component';
import { DateTimeControlComponent } from '../dynamic-controls/date-time-control.component';
import { EnumeratedControlComponent } from '../dynamic-controls/enumerated-control.component';
import { InputControlComponent } from '../dynamic-controls/input-control.component';
import { FormControlType } from '../form-control-spec.interface';

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
                date: DateTimeControlComponent
            };

            for (const type of Object.keys(expected)) {
                mapper.componentFor(type as FormControlType).should.equal(expected[type]);
            }
        });

        it('should throw an error on unrecognized types', () => {
            (() => mapper.componentFor('foo' as FormControlType)).should.throw(Error);
        });
    });
});
