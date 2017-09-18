import { DebugElement } from '@angular/core';
import {
    ComponentFixture, fakeAsync, TestBed,
    tick
} from '@angular/core/testing';
import { MdCardModule } from '@angular/material';

import * as sinon from 'sinon';

import { TableMeta } from '../../../common/api';
import { TableService } from '../core/table.service';
import { DynamicFormModule } from '../dynamic-form/dynamic-form.module';
import { FormContainerComponent } from './form-container.component';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const expect = global['chai'].expect;

describe('FormContainerComponent', () => {
    let fixture: ComponentFixture<FormContainerComponent>;
    let comp: FormContainerComponent;
    let de: DebugElement;

    let service: TableService;

    const mockTableMeta = (): TableMeta => ({
        name: 'foo',
        headers: [{
            name: 'pk',
            type: 'string',
            rawType: 'varchar(11)',
            isNumerical: false,
            isTextual: true,
            ordinalPosition: 1,
            signed: false,
            nullable: false,
            maxCharacters: 11,
            charset: 'UTF-8',
            numericPrecision: null,
            numericScale: null,
            enumValues: null,
            comment: '',
            tableName: 'foo'
        }],
        totalRows: 0,
        constraints: [],
        comment: 'description'
    });

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                DynamicFormModule,
                MdCardModule,
                NoopAnimationsModule
            ],
            declarations: [ FormContainerComponent ],
            providers: [
                // don't need any functionality unless we specify a foreign key
                // (which would require
                { provide: TableService, useValue: {} }
            ]
        });

        fixture = TestBed.createComponent(FormContainerComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        service = de.injector.get(TableService);
    });

    it('should display the name of the table', () => {
        comp.meta = mockTableMeta();
        comp.allowSubmit = false;
        comp.allowMultiple = false;
        fixture.detectChanges();

        const header = de.query(By.css('h2'));
        expect(header.nativeElement.textContent).to.include(comp.meta.name);
    });

    // TODO
    it('should allow multiple entries when [allowEntries] is true');

    it('shouldn\'t create a submit button when [allowSubmit] is false', () => {
        comp.meta = mockTableMeta();
        comp.allowSubmit = false;
        comp.allowMultiple = false;
        fixture.detectChanges();

        const submitButton = de.query(By.css('button'));
        expect(submitButton).to.be.null;
    });

    it('should submit the form when the submit button is clicked', fakeAsync(() => {
        comp.meta = mockTableMeta();
        comp.allowSubmit = true;
        comp.allowMultiple = false;
        fixture.detectChanges();

        const form = { pk: 'test' };
        // Prefer patchValue so we don't have to specify a value for the 'submit'
        // button. We just have to make sure that the patch actually took effect
        comp.dynamicForm.formGroup.patchValue(form);
        expect(comp.dynamicForm.formGroup.value).to.deep.equal(form);

        // Use a spy to verify that we were give the form when submitted
        const spy = sinon.spy();
        comp.submit.subscribe(spy);

        const submitButton = fixture.debugElement.query(By.css('button'));
        expect(submitButton).to.exist;
        // It's enough to know that the submit button exists, we can simulate
        // the click like this:
        comp.onFormSubmitted(form);

        // Wait until all async activities are finished
        tick();

        // Expect to see the Observable emit the form data
        expect(spy).to.have.been.calledOnce;
        expect(spy).to.have.been.calledWithExactly(form);
    }));
});
