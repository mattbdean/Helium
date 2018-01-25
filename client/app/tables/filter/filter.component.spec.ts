import { DebugElement } from '@angular/core';
import {
    ComponentFixture, fakeAsync, TestBed,
    tick
} from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatCardModule, MatCheckboxModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatOptionModule,
    MatSelectModule
} from '@angular/material';
import { By } from '@angular/platform-browser';
import {
    NoopAnimationsModule
} from '@angular/platform-browser/animations';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { FilterManagerComponent } from '../filter-manager/filter-manager.component';
import { FilterProviderService } from '../filter-provider/filter-provider.service';
import { FilterComponent } from './filter.component';
import { DatetimeInputComponent } from '../../core/datetime-input/datetime-input.component';

describe('FilterComponent', () => {
    let fixture: ComponentFixture<FilterComponent>;
    let comp: FilterComponent;
    let de: DebugElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [FilterComponent, DatetimeInputComponent],
            imports: [
                NoopAnimationsModule,
                MatCardModule,
                MatCheckboxModule,
                MatFormFieldModule,
                MatSelectModule,
                MatOptionModule,
                MatInputModule,
                MatIconModule,

                ReactiveFormsModule
            ],
            providers: [FilterProviderService]
        });

        fixture = TestBed.createComponent(FilterComponent);
        comp = fixture.componentInstance;
        comp.group = FilterManagerComponent.createFilterGroup();
        de = fixture.debugElement;
    });

    it('should disable the group and inputs when the checkbox is unchecked', () => {
        fixture.detectChanges();

        // Should be enabled by default
        expect(comp.group.enabled).to.be.true;

        const el = de.query(By.css('input[type=checkbox]')).nativeElement;

        const spy = sinon.spy(comp, 'onToggle');

        // Unchecking the checkbox should disable it
        el.click();
        expect(spy).to.have.been.calledOnce;
        expect(comp.group.enabled).to.be.false;
    });

    it('should send an event via `removed` when the remove button is clicked', fakeAsync(() => {
        fixture.detectChanges();

        const spy = sinon.spy();
        comp.removed.subscribe(spy);

        de.query(By.css('button.remove-filter-button')).nativeElement.click();
        tick();

        expect(spy).to.have.been.calledOnce;
    }));
});
