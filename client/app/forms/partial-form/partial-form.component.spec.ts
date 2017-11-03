import { Component, DebugElement, SimpleChange, Type } from '@angular/core';
import {
    ComponentFixture, fakeAsync, TestBed, tick
} from '@angular/core/testing';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatIconModule } from '@angular/material';
import { By } from '@angular/platform-browser';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';

import { Constraint } from '../../common/api';
import { TableService } from '../../core/table.service';
import { ComponentMapperService } from '../component-mapper/component-mapper.service';
import { AbstractFormControl } from '../dynamic-controls/abstract-form-control.class';
import { DynamicFormControlDirective } from '../dynamic-form-control.directive';
import {
    FormControlSpec,
    FormControlType
} from '../form-control-spec.interface';
import { FormSpecGeneratorService } from '../form-spec-generator/form-spec-generator.service';
import { PartialFormComponent } from './partial-form.component';
import { TableName } from '../../common/table-name';

const expect = global['chai'].expect;

interface MockTableMeta { name: string; }

describe('PartialFormComponent', () => {
    let fixture: ComponentFixture<PartialFormComponent>;
    let comp: PartialFormComponent;
    let de: DebugElement;
    let generator: FormSpecGeneratorService;
    let rootGroup: FormGroup;

    // Define form group specs for a master table and a part table
    const availableSpecs: { [tableName: string]: FormControlSpec[] } = {
        master: [
            {
                type: 'text',
                formControlName: 'pk',
                placeholder: 'pk',
                required: true
            }
        ],
        part: [
            {
                type: 'text',
                formControlName: 'part_pk',
                placeholder: 'part_pk',
                required: true
            },
            // This is probably what the generator would spit out, but since all
            // components will be mapped to MockFormControlComponent, we don't
            // *really* need to specify type='autocomplete' and
            // autocompleteValues, but it helps get the point across
            {
                type: 'autocomplete',
                formControlName: 'part_fk',
                placeholder: 'part_fk',
                required: true,
                autocompleteValues: Observable.of(["abc", "def", "ghi"])
            }
        ]
    };

    const tableServiceStub = {
        meta: (rawName: string): Observable<MockTableMeta> =>
            Observable.of({ name: rawName })
    };

    // This stub basically picks a value from availableSpecs
    const generatorServiceStub = {
        generate: (mockTableMeta: MockTableMeta): FormControlSpec[] => {
            const result = availableSpecs[mockTableMeta.name];
            if (result === undefined)
                throw new Error('No such spec: ' + mockTableMeta.name);
            return result;
        },
        bindingConstraints: (): Constraint[] => []
    };

    // Always return MockFormControlComponent, regardless of requested type
    const mapperServiceStub = {
        componentFor: (type: FormControlType): Type<any> => MockFormControlComponent
    };

    /** Initializes the component by calling its ngOnChanges method. */
    const initComponent = (role: 'master' | 'part') => {
        comp.ngOnChanges({
            namePropertyBinding: new SimpleChange(null, new TableName(role), true),
            rootGroupPropertyBinding: new SimpleChange(null, rootGroup, true),
            // Include to be complete but there is no listener for role
            role: new SimpleChange(null, role, true)
        });

        // This is the only property that can be assigned normally
        comp.role = role;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [
                DynamicFormControlDirective,
                MockFormControlComponent,
                PartialFormComponent
            ],
            imports: [
                MatButtonModule,
                MatIconModule,
                NoopAnimationsModule,
                ReactiveFormsModule,
                RouterTestingModule
            ],
            providers: [
                // Mock all of the required services
                { provide: ComponentMapperService, useValue: mapperServiceStub },
                { provide: FormSpecGeneratorService, useValue: generatorServiceStub },
                { provide: TableService, useValue: tableServiceStub }
            ]
        }).overrideModule(BrowserDynamicTestingModule, {
            set: {
                // Allow MockFormControlComponent to be created dynamically
                entryComponents: [ MockFormControlComponent ]
            }
        });

        fixture = TestBed.createComponent(PartialFormComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        generator = de.injector.get(FormSpecGeneratorService);
        rootGroup = new FormGroup({});
    });

    // Collection of CSS queries that are repeatedly made throughout the tests
    const queryFor = {
        entryContainers: (): DebugElement[] =>
            de.queryAll(By.css('.entry-container')),

        removeButton: (root: DebugElement) =>
            de.query(By.css('.remove-button-wrapper')),

        addButton: (): DebugElement =>
            de.query(By.css('.add-button-wrapper'))
    };

    it('should show the name of the table', () => {
        initComponent('master');
        fixture.detectChanges();

        // Make sure the form title gets updated
        expect(de.query(By.css('.form-title')).nativeElement.textContent).to.equal('master');
    });

    it('should add a FormArray to the root FormGroup', () => {
        initComponent('master');
        // Should be nothing in the rootGroup as of now
        expect(comp.rootGroup.controls).to.deep.equal({});

        // Apply the changes
        fixture.detectChanges();

        // Should have added a FormArray to the rootGroup whose key is the raw
        // name of the table
        expect(Object.keys(comp.rootGroup.controls)).to.deep.equal(['master']);
        expect(comp.rootGroup.controls.master).to.equal(comp.formArray);
    });

    it('should allow master tables exactly one entry', fakeAsync(() => {
        initComponent('master');
        fixture.detectChanges();
        tick();

        // Partial forms for master tables should include one entry container by
        // default
        const entryContainers = queryFor.entryContainers();
        expect(entryContainers).to.have.lengthOf(1);

        // This container shouldn't be removable
        const container = entryContainers[0];
        expect(queryFor.removeButton(container)).to.be.null;

        // There should not be an "add" button
        expect(queryFor.addButton()).to.be.null;
    }));

    it('should start part tables off with zero entries and allow adding and ' +
        'removing entries', fakeAsync(() => {

        initComponent('part');
        fixture.detectChanges();
        tick();

        // Should start out with zero containers
        expect(queryFor.entryContainers()).to.have.lengthOf(0);

        const addButtonWrapper = queryFor.addButton();
        expect(addButtonWrapper).to.not.be.null;

        // Click the actual button
        const addEntrySpy = sinon.spy(comp, 'addEntry');
        addButtonWrapper.query(By.css('button')).nativeElement.click();
        fixture.detectChanges();
        expect(addEntrySpy).to.have.been.calledOnce;

        // addEntry should have added a new entry container
        const entryContainers = queryFor.entryContainers();
        expect(entryContainers).to.have.lengthOf(1);

        // The add button should still be there
        expect(queryFor.addButton()).to.not.be.null;

        // Make sure we've added a "remove" button
        const removeButtonWrapper = queryFor.removeButton(entryContainers[0]);
        expect(removeButtonWrapper).to.not.be.null;

        // Click the remove button
        const removeEntrySpy = sinon.spy(comp, 'removeEntry');
        removeButtonWrapper.query(By.css('button')).nativeElement.click();
        fixture.detectChanges();
        expect(removeEntrySpy).to.have.been.calledOnce;

        // We should be back to no containers
        expect(queryFor.entryContainers()).to.have.lengthOf(0);
    }));
});

// By having our ComponentMapperService stub map everything to this component,
// we eliminate the need to import all of the actual dynamic form components
@Component({
    selector: 'mock-input-control',
    template: `
        <div [formGroup]="group">
            <input
                [type]="spec.subtype"
                [placeholder]="spec.placeholder"
                [formControlName]="spec.formControlName"
                [required]="spec.required">
        </div>
    `
})
class MockFormControlComponent extends AbstractFormControl {}
