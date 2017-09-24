
import { ComponentMapperService } from './component-mapper.service';
import { InputControlComponent } from './controls/input-control.component';
import { FormControlType } from './form-control-spec.interface';

describe('ComponentMapperService', () => {
    let mapper: ComponentMapperService;

    beforeEach(() => {
        mapper = new ComponentMapperService();
    });

    describe('componentFor', () => {
        it('should recognize basic types', () => {
            const expected: { [key: string]: any } = {
                text: InputControlComponent
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
