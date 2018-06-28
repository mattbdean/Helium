import {
    Component, DebugElement, Input,
    NO_ERRORS_SCHEMA
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { expect } from 'chai';
import { Observable, of } from 'rxjs';
import * as sinon from 'sinon';
import { TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { ApiService } from '../../core/api/api.service';
import { FormHostComponent } from './form-host.component';

describe('FormHostComponent', () => {
    let fixture: ComponentFixture<FormHostComponent>;
    let comp: FormHostComponent;
    let service: ApiService;
    let de: DebugElement;

    const ApiServiceStub = {
        tables: (name: string): Observable<any> => Observable.throw('Not stubbed')
    };

    const snackbarStub = {};

    const tableNamesObservable = (...rawNames: string[]) => {
        return of(rawNames.map((n) => new TableName('schema', n)));
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [
                FormHostComponent
            ],
            imports: [
                ReactiveFormsModule,
                RouterTestingModule
            ],
            providers: [
                {
                    provide: ActivatedRoute,
                    // name will always be 'master'
                    useValue: {
                        params: of({ name: 'master' }),
                        queryParams: of({})
                    }
                },
                { provide: ApiService, useValue: ApiServiceStub },
                { provide: MatSnackBar, useValue: snackbarStub }
            ],
            // Ignore missing children (aka PartialFormComponent)
            schemas: [NO_ERRORS_SCHEMA]
        });

        fixture = TestBed.createComponent(FormHostComponent);
        comp = fixture.componentInstance;
        service = fixture.componentRef.injector.get(ApiService);
        de = fixture.debugElement;
    });

    describe('submit button', () => {
        it('should be disabled when the form is invalid', () => {
            const assertReaction = (formHasErrors: boolean) => {
                comp.formGroup.setErrors(formHasErrors ? { test: true } : null);
                fixture.detectChanges();
                expect(comp.formGroup.invalid).to.equal(formHasErrors);
                expect(de.query(By.css('button')).nativeElement.disabled).to.equal(formHasErrors);
            };

            sinon.stub(service, 'tables')
                .returns(tableNamesObservable('master'));

            fixture.detectChanges();

            // Make the form invalid, make sure the button becomes disabled
            assertReaction(true);

            // Make the form valid, make sure button becomes enabled
            assertReaction(false);
        });
    });
});
