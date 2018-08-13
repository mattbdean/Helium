import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { expect } from 'chai';
import { take } from 'rxjs/operators';
import * as sinon from 'sinon';
import { TableHeader, TableMeta } from '../../common/api';
import { DynamicFormsModule } from '../../dynamic-forms/dynamic-forms.module';
import { FormControlSpec, FormControlType } from '../../dynamic-forms/form-control-spec';
import { FormSpecGeneratorService } from '../../dynamic-forms/form-spec-generator/form-spec-generator.service';
import { FormEntryComponent, FormEntrySnapshot } from './form-entry.component';

describe('FormEntryComponent', () => {
    let fixture: ComponentFixture<FormEntryComponent>;
    let comp: FormEntryComponent;
    let specGen: FormSpecGeneratorService;

    function mockFormControlSpec(header: TableHeader | string) {
        return {
            type: 'text' as FormControlType,
            formControlName: typeof header === 'string' ? header : header.name,
            placeholder: typeof header === 'string' ? header : header.name,
            required: true
        };
    }

    const formSpecGenStub = {
        generate: (meta: TableMeta): FormControlSpec[] => {
            return meta.headers.map(mockFormControlSpec);
        }
    };

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
                { provide: FormSpecGeneratorService, useValue: formSpecGenStub }
            ]
        });
        
        fixture = TestBed.createComponent(FormEntryComponent);
        comp = fixture.componentInstance;
        specGen = TestBed.get(FormSpecGeneratorService);

        comp.meta = {
            headers: [
                { name: 'foo' },
                { name: 'bar' }
            ]
        } as any;
    });

    it('should react to changes in the TableMeta', () => {
        // Manually call ngOnChanges since Angular won't do it for us since we
        // set comp.meta manually
        comp.ngOnChanges();
        fixture.detectChanges();

        expect(Object.keys(comp.group.controls)).to.deep.equal(['foo', 'bar']);
    });

    it('should emit updates via entryUpdated', (done) => {
        const emitted: FormEntrySnapshot[] = [];
        const defaultValue = 'defaultValue';

        // Assign this stub before we call ngOnChanges() so that it actually has
        // an effect
        sinon.stub(specGen, 'generate')
            .returns(['foo', 'bar'].map((headerName) => {
                const spec: any = mockFormControlSpec(headerName);
                spec.defaultValue = defaultValue;
                return spec;
            }));

        comp.ngOnChanges();
        fixture.detectChanges();

        comp.entryUpdated.pipe(take(2)).subscribe({
            next: (snapshot: FormEntrySnapshot) => { emitted.push(snapshot); },
            complete: () => {
                try {
                    expect(emitted).to.deep.equal([
                        {
                            valid: true,
                            value: {
                                foo: defaultValue,
                                bar: defaultValue
                            }
                        },
                        {
                            valid: true,
                            value: {
                                foo: 'hello',
                                bar: defaultValue
                            }
                        }
                    ]);
                    done();
                } catch (err) {
                    done(err);
                }
            }
        });

        // Patch in next event loop so entryUpdated has time to emit before we
        // update the group value
        setTimeout(() => {
            comp.group.patchValue({
                foo: 'hello',
            }, { emitEvent: true });
        }, 1);
    });

    describe('valid', () => {
        it('should be true only when the form is valid', () => {
            comp.ngOnChanges();
            fixture.detectChanges();

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
            comp.ngOnChanges();
            fixture.detectChanges();

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
            comp.ngOnChanges();
            fixture.detectChanges();

            comp.patchValue({ foo: 'hello' });
            expect(comp.value.foo).to.equal('hello');
        });

        it('should not allow unknown form control names to be specified', () => {
            comp.ngOnChanges();
            fixture.detectChanges();

            expect(() => comp.patchValue({ baz: 'should not work' })).to.throw(Error);
        });
    });
});
