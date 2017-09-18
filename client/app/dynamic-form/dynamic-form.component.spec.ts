import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MdAutocompleteModule, MdButtonModule, MdCheckboxModule, MdDatepickerModule,
    MdInputModule, MdNativeDateModule, MdSelectModule
} from '@angular/material';

import { DebugElement } from '@angular/core';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';
import {
    BrowserAnimationsModule,
} from '@angular/platform-browser/animations';

import * as _ from 'lodash';

import { By } from '@angular/platform-browser';
import { DynamicFieldDirective } from './dynamic-field.directive';
import { DynamicFormComponent } from './dynamic-form.component';
import { FieldConfig } from './field-config.interface';
import { FormInputComponent } from './form-input/form-input.component';
import { FormSelectComponent } from './form-select/form-select.component';
import { FormSubmitComponent } from './form-submit/form-submit.component';

const expect = global['chai'].expect;

describe('DynamicFormComponent', () => {
    let fixture: ComponentFixture<DynamicFormComponent>;
    let comp: DynamicFormComponent;
    let de: DebugElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                BrowserAnimationsModule,
                MdAutocompleteModule,
                MdButtonModule,
                MdCheckboxModule,
                MdDatepickerModule,
                MdNativeDateModule,
                MdInputModule,
                MdSelectModule,
                ReactiveFormsModule
            ],
            declarations: [
                DynamicFormComponent,
                DynamicFieldDirective,
                FormInputComponent,
                FormSelectComponent,
                FormSubmitComponent
            ]
        }).overrideModule(BrowserDynamicTestingModule, {
            set: {
                entryComponents: [
                    FormInputComponent,
                    FormSelectComponent,
                    FormSubmitComponent
                ]
            }
        });

        fixture = TestBed.createComponent(DynamicFormComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
    });

    it('should do nothing when given an empty config', () => {
        comp.config = [];
        fixture.detectChanges();

        const form = de.query(By.css('form.dynamic-form'));
        expect(form).to.exist;

        expect(form.children).to.be.empty;
    });

    it('should create a control in the FormGroup based on the name of the FieldConfig', () => {
        comp.config = [
            {
                name: 'foo',
                label: 'Test',
                type: 'input'
            },
            {
                name: 'bar',
                label: 'Test2',
                type: 'input'
            }
        ];
        fixture.detectChanges();
        expect(_.sortBy(Object.keys(comp.formGroup.controls))).to.deep.equal(['bar', 'foo']);

        // Form hasn't been touched yet, should still be pristine
        expect(comp.formGroup.controls.foo.pristine).to.be.true;
        expect(comp.formGroup.controls.bar.pristine).to.be.true;
        expect(comp.formGroup.pristine).to.be.true;
    });

    describe('type of "input"', () => {
        const createConfig = (subtype: string, required: boolean = false): FieldConfig => ({
            name: 'foo',
            label: 'Test',
            type: 'input',
            subtype,
            required
        });

        it('should create a checkbox when the subtype is "checkbox"', () => {
            comp.config = [createConfig('checkbox')];
            fixture.detectChanges();
            const checkbox = de.query(By.css('md-checkbox'));
            expect(checkbox).to.exist;

            // We need to .trim() the textContent because the label <span> has
            // another span nested in it containing a &nbsp; styled with
            // "display: none;", so the full text becomes ' $label'
            const label = de.query(By.css('span.mat-checkbox-label')).nativeElement.textContent.trim();
            expect(label).to.equal(comp.config[0].label);
        });

        it('should create a datepicker when the subtype is "date"', () => {
            comp.config = [createConfig('date')];
            fixture.detectChanges();

            expect(de.query(By.css('button.mat-datepicker-toggle'))).to.exist;
            expect(de.query(By.css('md-datepicker'))).to.exist;
        });

        it('should delegate unknown subtypes to the input without any other special treatment', () => {
            comp.config = [createConfig('datetime-local')];
            fixture.detectChanges();

            expect(de.query(By.css(`input[type=${comp.config[0].subtype}]`))).to.exist;
        });

        it('should respect the "required" FieldConfig property', () => {
            comp.config = [createConfig('text', true)];
            fixture.detectChanges();

            const input = de.query(By.css('input[type=text]'));
            expect(input).to.exist;
            expect(comp.formGroup.controls.foo.pristine).to.be.true;

            // Set the initial value
            const control = comp.formGroup.controls.foo;
            expect(control.errors).to.deep.equal({ required: true });
            comp.formGroup.setValue({ foo: 'foo' });
            expect(control.errors).to.be.null;
        });

        it('should use autocomplete when FieldConfig.fetchAutocompleteValues is specified', () => {
            const conf = createConfig('text');
            conf.fetchAutocompleteValues = () => Promise.resolve(['foo', 'bar', 'baz']);
            comp.config = [conf];

            fixture.detectChanges();

            // We can't really do anything else besides make sure that an
            // <md-autocomplete> exists
            expect(de.query(By.css('md-autocomplete'))).to.exist;
        });
    });

    describe('type of "select"', () => {
        it('should provide a dropdown of values specified from the field config', () => {
            comp.config = [{
                name: 'foo',
                label: 'Test',
                type: 'select',
                options: ['foo', 'bar', 'baz']
            }];
            fixture.detectChanges();

            // <md-select> doesn't keep the options in the markup, so we can only
            // verify that its created the element itself and trust our e2e's
            expect(de.query(By.css('md-select'))).to.exist;
        });
    });

    describe('type of "submit"', () => {
        it('should create a button', () => {
            comp.config = [{
                name: 'submit',
                label: 'Submit',
                type: 'submit'
            }];
            fixture.detectChanges();

            // Make sure the button text is accurate
            expect(de.query(By.css('span.mat-button-wrapper')).nativeElement.textContent.trim())
                .to.equal(comp.config[0].label);
        });

        it('should submit the form when clicked', () => {
            comp.config = [
                {
                    name: 'submit',
                    label: 'Submit',
                    type: 'submit'
                }
            ];
            fixture.detectChanges();

            const button = de.query(By.css('button'));
            expect(button).to.exist;

            comp.submit.subscribe((form: object) => {
                expect(form).to.deep.equal({ submit: undefined });
            });
            button.nativeElement.click();
        });

        it('should be disabled when the form is invalid', () => {
            comp.config = [
                {
                    name: 'foo',
                    label: 'Foo',
                    type: 'input',
                    value: 'initial value',
                    required: true
                },
                {
                    name: 'submit',
                    label: 'Submit',
                    type: 'submit',
                    disabled: false
                }
            ];
            fixture.detectChanges();

            const button = de.query(By.css('button'));
            expect(button).to.exist;

            // Make sure there are no errors and the button isn't disabled
            expect(comp.formGroup.controls.foo.errors).to.be.null;
            expect(comp.config[1].disabled).to.be.false;

            // Give the input an empty value to trigger the 'required' error
            comp.formGroup.patchValue({ foo: '' });

            // Make sure the required error is present and that the button is
            // disabled
            expect(comp.formGroup.controls.foo.errors).to.deep.equal({ required: true });
            expect(comp.config[1].disabled).to.be.true;
        });
    });
});
