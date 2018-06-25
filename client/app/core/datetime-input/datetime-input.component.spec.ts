import { DebugElement } from '@angular/core';
import {
    ComponentFixture, TestBed,
} from '@angular/core/testing';
import { MatFormFieldModule, MatInputModule } from '@angular/material';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { DatetimeInputComponent } from './datetime-input.component';

chai.use(sinonChai);

const expect = chai.expect;

describe('DatetimeInputComponent', () => {
    let fixture: ComponentFixture<DatetimeInputComponent>;
    let comp: DatetimeInputComponent;
    let de: DebugElement;

    let dateInput: DebugElement;
    let timeInput: DebugElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [DatetimeInputComponent],
            imports: [
                MatInputModule,
                MatFormFieldModule,
                NoopAnimationsModule
            ]
        });

        fixture = TestBed.createComponent(DatetimeInputComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;

        dateInput = de.query(By.css('input[type=date]'));
        timeInput = de.query(By.css('input[type=time]'));
    });

    /**
     * Gets the placeholder of the specified input, or null if one can't be
     * found
     */
    const placeholder = (what: 'date' | 'time'): string | null => {
        const index = what === 'date' ? 1 : 2;

        const el = de.query(By.css(`mat-form-field:nth-child(${index}) label`));
        if (el === null)
            return null;

        return el.nativeElement.textContent;
    };

    describe('placeholder', () => {

        it('should show the given placeholder for only the date input when provided', () => {
            comp.placeholder = 'Foo';
            fixture.detectChanges();

            // Make sure the date input has a placeholder
            expect(placeholder('date')).to.equal(comp.placeholder);

            // ...and that the time input does not
            expect(placeholder('time')).to.be.null;
        });

        it('should show a generic placeholder on both inputs when not provided', () => {
            fixture.detectChanges();
            expect(comp.placeholder).to.equal('');

            // Make sure it shows generic placeholders when none is provided
            expect(placeholder('date')).to.equal('Date');
            expect(placeholder('time')).to.equal('Time');
        });
    });

    describe('required', () => {
        // If the [required] attribute has been set to true, the placeholder
        // will end with a ' *'. For example, an optional matInput would have
        // a placeholder of 'Foo', but a required matInput would have a
        // placeholder of 'Foo *'. Note that the space in between the label and
        // the '*' is a non-breaking space, which is not the same as a normal
        // space.
        const label = 'Foo';

        it('should make both fields required when true', () => {
            comp.required = true;
            comp.placeholder = label;
            fixture.detectChanges();

            expect(placeholder('date')).to.match(/\*$/);
        });

        it('should make both fields not required when false', () => {
            comp.required = false;
            comp.placeholder = label;
            fixture.detectChanges();

            expect(placeholder('date')).to.equal(label);
        });
    });

    describe('registerOnChange', () => {
        it('should emit a value when both the date and time have inputs', () => {
            fixture.detectChanges();
            const spy = sinon.spy();

            // Inject our spy. Normally this would be done by Angular's Reactive
            // Forms Module
            comp.registerOnChange(spy);

            // Use the debug elements to set the value of the inputs
            dateInput.nativeElement.value = '2018-02-01';
            timeInput.nativeElement.value = '00:00';

            // Manually trigger the input event
            const ev = new KeyboardEvent('input');
            dateInput.nativeElement.dispatchEvent(ev);
            timeInput.nativeElement.dispatchEvent(ev);

            // Make sure it outputs in the right format
            expect(spy).to.have.been.calledOnce;
            expect(spy).to.have.been.calledWithExactly('2018-02-01 00:00:00');
        });
    });

    describe('registerOnTouched', () => {
        it('should call the registered function when either date or time inputs are blurred', () => {
            fixture.detectChanges();
            const spy = sinon.spy();

            comp.registerOnTouched(spy);

            // Manually dispatch a blur event. Blurring either the date input or
            // the time input should trigger the callback given to
            // registerOnTouched
            const ev = new FocusEvent('blur');
            dateInput.nativeElement.dispatchEvent(ev);
            expect(spy).to.have.been.calledOnce;

            timeInput.nativeElement.dispatchEvent(ev);
            expect(spy).to.have.been.calledTwice;

            // Blurring the host should have no effect
            de.nativeElement.dispatchEvent(ev);
            expect(spy).to.have.been.calledTwice;
        });
    });

    describe('writeValue', () => {
        it('should adjust the value of the date and time input given a valid date string', () => {
            fixture.detectChanges();

            comp.writeValue('2018-02-01 00:00');
            fixture.detectChanges();

            expect(dateInput.nativeElement.value).to.equal('2018-02-01');
            expect(timeInput.nativeElement.value).to.equal('00:00');
        });

        it('should reset the fields when given an empty string', () => {
            fixture.detectChanges();

            comp.writeValue('');
            fixture.detectChanges();

            expect(dateInput.nativeElement.value).to.equal('');
            expect(timeInput.nativeElement.value).to.equal('');
        });

        it('should throw an Error when given anything but a string', () => {
            fixture.detectChanges();

            for (const obj of [true, undefined, {}, []]) {
                expect(() => comp.writeValue(obj)).to.throw(Error);
            }
        });

        it('should throw an Error when given an invalid date string', () => {
            fixture.detectChanges();

            const invalid = [
                'foo',
                '01/02/2018 00:00:00',
                '01-02-2018 00:00:00'
            ];

            for (const input of invalid) {
                expect(() => comp.writeValue(input)).to.throw(Error);
            }
        });
    });
});
