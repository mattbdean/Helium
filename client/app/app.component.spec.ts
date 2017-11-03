import { DebugElement } from '@angular/core';
import {
    ComponentFixture, fakeAsync, TestBed,
    tick
} from '@angular/core/testing';
import { MatSidenavModule } from '@angular/material';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

import * as _ from 'lodash';
import * as sinon from 'sinon';

import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable } from 'rxjs/Observable';
import { AppComponent } from './app.component';
import { TableTier } from './common/api';
import { TABLE_TIER_PREFIX_MAPPING } from './common/constants';
import { TableName } from './common/table-name';
import { CoreModule } from './core/core.module';
import { TableService } from './core/table.service';

const expect = global['chai'].expect;

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let comp: AppComponent;
    let de: DebugElement;
    let service: TableService;

    // TABLE_TIER_PREFIX_MAPPING maps prefixes to tiers, invert it so we can
    // map tiers to prefixes
    const tierToPrefixMapping = _.invert(TABLE_TIER_PREFIX_MAPPING);

    /**
     * Gets the prefix for the given TableTier, or an empty string if non exists
     */
    const prefixFor = (t: TableTier): string => tierToPrefixMapping[t] || '';

    /** Dynamically create TableName objects based on the given TableTiers */
    const createTableNames = (...tiers: TableTier[]): TableName[] => {
        return _.map(tiers, (t, index): TableName => new TableName({
            rawName: prefixFor(t) + 'table_' + index,
            tier: t,
            cleanName: 'table_' + index,
            masterRawName: null
        }));
    };

    /** An array of TableTiers in a pseudo-random order */
    const types: TableTier[] = [
        'hidden', 'manual', 'lookup', 'manual', 'imported', 'computed',
        'computed', 'manual', 'imported', 'hidden'
    ];

    /** The amount of times each type is included in `types` */
    const counts = _.countBy(types);

    const serviceStub = {
        list: (): Observable<TableName[]> => Observable.of(
            createTableNames(...types)
        )
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                CoreModule,
                MatSidenavModule,
                NoopAnimationsModule,
                RouterTestingModule
            ],
            declarations: [ AppComponent ],
            providers: [
                { provide: TableService, useValue: serviceStub }
            ]
        });

        fixture = TestBed.createComponent(AppComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        service = de.injector.get(TableService);
    });

    it('should automatically pull in all available tables', fakeAsync(() => {
        const spy = sinon.spy(service, 'list');
        fixture.detectChanges();
        tick();
        expect(spy).to.have.been.calledOnce;
    }));

    it('should create a section for each tier', fakeAsync(() => {
        fixture.detectChanges();
        tick();

        const listElements = de.queryAll(By.css('ul li'));

        // One <li> for each table and one for each header for each unique type
        expect(listElements).to.have.lengthOf(types.length + _.uniq(types).length);

        let headerChildren: DebugElement[] = [];
        let currentHeader: DebugElement = listElements[0];

        const headerOrder: TableTier[] = [currentHeader.nativeElement.dataset.tier];

        // Make sure the first <li> is a header
        expect(currentHeader.nativeElement.classList.contains('header')).to.be.true;

        for (let i = 1; i < listElements.length; i++) {
            const li = listElements[i];

            if (li.nativeElement.classList.contains('header')) {
                // Make sure we have the correct amount of children
                const expectedLength = counts[currentHeader.nativeElement.dataset.tier];
                expect(headerChildren).to.have.lengthOf(expectedLength);

                // Keep track of the order in which the headers appear
                const headerTier = li.nativeElement.dataset.tier;
                expect(headerTier).to.exist;
                headerOrder.push(headerTier);

                // Reset for the next section
                currentHeader = li;
                headerChildren = [];
            } else {
                // Make sure non-headers are table references
                expect(li.nativeElement.classList.contains('table-ref-container')).to.be.true;

                // Keep track of the table refs under the current header
                headerChildren.push(li);
            }
        }

        // Make sure everything is organized in the right order
        expect(headerOrder).to.deep.equal(AppComponent.TIER_ORDER);
    }));
});
