import { DebugElement } from '@angular/core';
import {
    ComponentFixture, fakeAsync, TestBed, tick
} from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatFormFieldModule,
    MatSelectModule, MatSidenavModule,
    MatToolbarModule
} from '@angular/material';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';
import * as sinon from 'sinon';
import { AppComponent } from './app.component';
import { TableTier } from './common/api';
import { TABLE_TIER_PREFIX_MAPPING } from './common/constants';
import { TableName } from './common/table-name';
import { AuthService } from './core/auth/auth.service';
import { CoreModule } from './core/core.module';
import { TableService } from './core/table/table.service';

const expect = global['chai'].expect;

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let comp: AppComponent;
    let de: DebugElement;
    let service: TableService;
    let auth: AuthService;

    // TABLE_TIER_PREFIX_MAPPING maps prefixes to tiers, invert it so we can
    // map tiers to prefixes
    const tierToPrefixMapping = _.invert(TABLE_TIER_PREFIX_MAPPING);

    /**
     * Gets the prefix for the given TableTier, or an empty string if non exists
     */
    const prefixFor = (t: TableTier): string => tierToPrefixMapping[t] || '';

    /** Dynamically create TableName objects based on the given TableTiers */
    const createTableNames = (schema: string, ...tiers: TableTier[]): TableName[] => {
        return _.map(tiers, (t, index): TableName => new TableName(schema, {
            // Include the schema name in the raw name for the sake of testing.
            // In the real world, this probably isn't going to happen
            name: {
                raw: prefixFor(t) + schema + '_table_' + index,
                clean: schema.charAt(0).toUpperCase() + schema.slice(1) + 'Table' + index
            },
            tier: t,
            masterName: null
        }));
    };

    /** An array of TableTiers in a pseudo-random order */
    const types: TableTier[] = [
        'hidden', 'manual', 'lookup', 'manual', 'imported', 'computed',
        'computed', 'manual', 'imported', 'hidden', 'unknown'
    ];

    const schemas = ['schema1', 'schema2'];

    /** The amount of times each type is included in `types` */
    const counts = _.countBy(types);

    const serviceStub = {
        schemas: () => Observable.of(schemas),
        tables: (schema: string): Observable<TableName[]> => Observable.of(
            createTableNames(schema, ...types)
        )
    };

    const authStub = {
        // Always logged in
        watchAuthState: () => Observable.of(true)
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                CoreModule,
                MatSelectModule,
                MatFormFieldModule,
                MatSidenavModule,
                MatToolbarModule,
                NoopAnimationsModule,
                ReactiveFormsModule,
                RouterTestingModule,
            ],
            declarations: [ AppComponent ],
            providers: [
                { provide: TableService, useValue: serviceStub },
                { provide: AuthService, useValue: authStub }
            ]
        });

        fixture = TestBed.createComponent(AppComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        service = de.injector.get(TableService);
        auth = de.injector.get(AuthService);

        // Make the router always return a URL
        sinon.stub(de.injector.get(Router), 'url').get(() => '/foo');
    });

    it('should automatically pull in all available schemas and load the first one', fakeAsync(() => {
        const schemasSpy = sinon.spy(service, 'schemas');
        const tablesSpy = sinon.spy(service, 'tables');
        fixture.detectChanges();
        tick();
        expect(schemasSpy).to.have.been.called;

        // Should automatically set the schema
        const expectedSchema = schemas[0];
        expect(comp.schemaControl.value).to.equal(expectedSchema);
        expect(tablesSpy).to.have.been.calledWithExactly(expectedSchema);

    }));

    it('should create a section for each tier', fakeAsync(() => {
        tick();
        fixture.detectChanges();

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
