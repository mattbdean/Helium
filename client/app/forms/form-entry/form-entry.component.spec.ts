import { DebugElement, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { expect } from 'chai';
import { TableMeta } from '../../common/api';
import { DynamicFormsModule } from '../../dynamic-forms/dynamic-forms.module';
import { FormControlSpec, FormControlType } from '../../dynamic-forms/form-control-spec';
import { FormSpecGeneratorService } from '../../dynamic-forms/form-spec-generator/form-spec-generator.service';
import { FormEntryComponent, FormEntrySnapshot } from './form-entry.component';

describe('FormEntryComponent', () => {
    let fixture: ComponentFixture<FormEntryComponent>;
    let comp: FormEntryComponent;

    const mockFormSpecGen: FormSpecGeneratorService = {
        generate: (meta: TableMeta): FormControlSpec[] => {
            return meta.headers.map((h) => ({
                type: 'text' as FormControlType,
                formControlName: h.name,
                placeholder: h.name,
                required: true
            }));
        }
    } as any;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                DynamicFormsModule,
                NoopAnimationsModule
            ],
            schemas: [
                NO_ERRORS_SCHEMA
            ],
            declarations: [
                FormEntryComponent
            ],
            providers: [
                { provide: FormSpecGeneratorService, useValue: mockFormSpecGen }
            ]
        });
        
        fixture = TestBed.createComponent(FormEntryComponent);
        comp = fixture.componentInstance;

        comp.meta = {
            headers: [
                { name: 'foo' },
                { name: 'bar' }
            ]
        } as any;

        // Manually call ngOnChanges since Angular won't do it for us since we
        // set comp.meta manually
        comp.ngOnChanges();
        fixture.detectChanges();
    });

    it('should react to changes in the TableMeta', () => {
        expect(Object.keys(comp.group.controls)).to.deep.equal(['foo', 'bar']);
    });

    it('should emit updates via entryUpdated', (done) => {
        comp.entryUpdated.subscribe((snapshot: FormEntrySnapshot) => {
            expect(snapshot.valid).to.be.false;
            expect(snapshot.value).to.deep.equal({
                foo: 'hello',
                bar: null
            });
            done();
        });

        comp.group.patchValue({
            foo: 'hello',
        }, { emitEvent: true });
    });

    describe('valid', () => {
        it('should be true only when the form is valid', () => {
            // The only validator for the controls is Validators.required
            expect(comp.valid).to.be.false;

            comp.patchValue({ foo: 'hello' });
            expect(comp.valid).to.be.false;

            comp.patchValue({ bar: 'world' });
            expect(comp.valid).to.be.true;
        });
    });

    describe('value', () => {
        it('should report the current value of the form', () => {
            expect(comp.value).to.deep.equal({
                foo: null,
                bar: null
            });

            comp.patchValue({
                foo: 'hello',
                bar: 'world'
            });

            expect(comp.value).to.deep.equal({
                foo: 'hello',
                bar: 'world'
            });
        });
    });

    describe('patchValue', () => {
        it('should allow a subset of the columns to be specified', () => {
            comp.patchValue({ foo: 'hello' });
            expect(comp.value.foo).to.equal('hello');
        });

        it('should not allow unknown form control names to be specified', () => {
            expect(() => comp.patchValue({ baz: 'should not work' })).to.throw(Error);
        });
    });
});
