import { Component, DebugElement, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';

import { TableName } from '../../common/table-name.class';
import { TableService } from '../../core/table.service';
import { FormHostComponent } from './form-host.component';

const expect = global['chai'].expect;

describe('FormHostComponent', () => {
    let fixture: ComponentFixture<FormHostComponent>;
    let comp: FormHostComponent;
    let service: TableService;
    let de: DebugElement;

    const tableServiceStub = {
        list: (): Observable<any> => Observable.throw('Not stubbed')
    };

    const snackbarStub = {};

    const tableNamesObservable = (...rawNames: string[]) => {
        return Observable.of(rawNames.map((n) => new TableName(n)));
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [
                FormHostComponent,
                PartialFormMock
            ],
            imports: [
                ReactiveFormsModule,
                RouterTestingModule
            ],
            providers: [
                {
                    provide: ActivatedRoute,
                    // name will always be 'master'
                    useValue: { params: Observable.of({ name: 'master' }) }
                },
                { provide: TableService, useValue: tableServiceStub },
                { provide: MatSnackBar, useValue: snackbarStub }
            ]
        });

        fixture = TestBed.createComponent(FormHostComponent);
        comp = fixture.componentInstance;
        service = fixture.componentRef.injector.get(TableService);
        de = fixture.debugElement;
    });

    describe('prepareSubmit', () => {
        it('should put all master table properties into one object', () => {
            // Only tell the component about a fictional master table
            const stub = sinon.stub(service, 'list')
                .returns(tableNamesObservable('master'));

            fixture.detectChanges();
            expect(stub).to.have.been.calledOnce;

            const masterEntry = {
                foo: 1,
                bar: 2
            };

            const rawForm = {
                master: [ masterEntry ]
            };

            expect(comp.prepareSubmit(rawForm)).to.deep.equal(masterEntry);
        });

        it('should add all part tables to $parts', () => {
            // Tell the component about a master and part table
            sinon.stub(service, 'list')
                .returns(tableNamesObservable('master', 'master__part'));
            fixture.detectChanges();

            const masterEntry = { foo: 1 };
            const partEntries = [{ bar: 1 }, { bar: 2 }];

            const rawForm = {
                master: [masterEntry],
                master__part: partEntries
            };

            const expected = {
                foo: 1,
                $parts: {
                    part: partEntries
                }
            };

            expect(comp.prepareSubmit(rawForm)).to.deep.equal(expected);
        });
    });

    describe('submit button', () => {
        it('should be disabled when the form is invalid', () => {
            const assertReaction = (formHasErrors: boolean) => {
                comp.formGroup.setErrors(formHasErrors ? { test: true } : null);
                fixture.detectChanges();
                expect(comp.formGroup.invalid).to.equal(formHasErrors);
                expect(de.query(By.css('button')).nativeElement.disabled).to.equal(formHasErrors);
            };

            sinon.stub(service, 'list')
                .returns(tableNamesObservable('master'));

            fixture.detectChanges();

            // Make the form invalid, make sure the button becomes disabled
            assertReaction(true);

            // Make the form valid, make sure button becomes enabled
            assertReaction(false);
        });
    });
});

// Include this component so we don't have to include PartialFormComponent and
// all its dependencies
@Component({
    selector: 'partial-form',
    template: `<p>Mock partial form for {{ name.rawName }}</p>`
})
class PartialFormMock {
    @Input()
    public rootGroup;

    @Input()
    public name: TableName;

    @Input()
    public role;
}
