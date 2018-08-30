import { CommonModule } from '@angular/common';
import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatFormFieldModule,
    MatIconModule,
    MatOptionModule,
    MatSelectModule,
    MatSidenavModule
} from '@angular/material';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import * as chai from 'chai';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { TableName } from '../common/table-name';
import { ApiService } from '../core/api/api.service';
import { AuthService } from '../core/auth/auth.service';
import { SidenavComponent } from './sidenav.component';

chai.use(sinonChai);
const expect = chai.expect;

describe('SidenavComponent', () => {
    let fixture: ComponentFixture<SidenavComponent>;
    let comp: SidenavComponent;
    let de: DebugElement;
    let api: ApiService;
    let auth: AuthService;

    const authServiceStub = {
        watchAuthState: () => { throw new Error('AuthService.watchAuthState() not stubbed'); }
    };

    const apiServiceStub = {
        schemas: () => { throw new Error('ApiService.schemas() not stubbed'); },
        tables: () => { throw new Error('ApiService.tables() not stubbed'); }
    };

    const routerStub = {
        events: of()
    };

    let currentPathStub: sinon.SinonStub;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [
                SidenavComponent
            ],
            imports: [
                CommonModule,
                MatIconModule,
                MatFormFieldModule,
                MatSidenavModule,
                MatSelectModule,
                MatOptionModule,
                ReactiveFormsModule,
                RouterModule,
                NoopAnimationsModule
            ],
            providers: [
                { provide: AuthService, useValue: authServiceStub },
                { provide: ApiService, useValue: apiServiceStub },
                { provide: Router, useValue: routerStub }
            ]
        });

        fixture = TestBed.createComponent(SidenavComponent);
        comp = fixture.componentInstance;
        de = fixture.debugElement;
        api = TestBed.get(ApiService);
        auth = TestBed.get(AuthService);

        // Provide defaults for particular methods which most tests rely on
        currentPathStub = sinon.stub(comp, 'currentPath').returns([]);
        sinon.stub(auth, 'watchAuthState').returns(of(true));
    });

    it('should provide sane defaults on initialization', () => {
        expect(comp.toggleMode).to.equal('toggleRequired');
        expect(comp.showable).to.be.true;
        expect(comp.opened).to.be.false;
        expect(comp.disableClose).to.be.false;
    });

    it('should pick a default schema on initialization', fakeAsync(() => {
        const schema = 'foo';

        sinon.stub(api, 'schemas').returns(of([schema]));
        fixture.detectChanges();
        tick();
        
        expect(comp.schema).to.equal(schema);
    }));

    it('should not select a default schema if there are no schemas available', (done) => {
        sinon.stub(api, 'schemas').returns(of([]));
        // Throw an error if we try to fetch the tables of no schema
        sinon.stub(api, 'tables').throws(Error);

        fixture.detectChanges();

        comp.schemas$.subscribe(() => {
            fixture.detectChanges();

            expect(comp.schema).to.be.null;
            done();
        });

    });

    it('should load the tables for the selected schema', (done) => {
        // Use delay(1) to introduce some async, emulates real-world use
        sinon.stub(api, 'schemas').returns(of(['foo']).pipe(delay(1)));
        const tablesStub = sinon.stub(api, 'tables').returns(of([new TableName('foo', 'bar')]));

        fixture.detectChanges();

        // Fetch the schemas, select one, trigger tables$ emission
        comp.schemas$.subscribe();
        comp.tables$.subscribe(() => {
            expect(tablesStub).to.have.been.calledWithExactly('foo');
            done();
        });
    });

    it('should include a "report a bug" button', () => {
        sinon.stub(api, 'schemas').returns(of([]));
        fixture.detectChanges();

        const link = de.query(By.css('.bug-report-wrapper a'));
        expect(link).to.exist;

        expect(link.attributes.href).to.equal('https://github.com/mattbdean/Helium/issues/new');
    });

    describe('open', () => {
        it('should do nothing if not showable', () => {
            expect(comp.opened).to.be.false;
            comp.showable = false;
            comp.open();
            expect(comp.opened).to.be.false;
        });

        it('should do nothing if already opened', () => {
            comp.open();
            expect(comp.opened).to.be.true;
            comp.open();
            expect(comp.opened).to.be.true;
        });

        it('should open the sidenav', () => {
            expect(comp.opened).to.be.false;
            comp.open();
            expect(comp.opened).to.be.true;
        });
    });

    describe('close', () => {
        it('should do nothing if close disabled', () => {
            comp.toggleMode = 'alwaysDisplayed';
            expect(comp.opened).to.be.true;
            expect(comp.disableClose).to.be.true;
            comp.close();
            expect(comp.opened).to.be.true;
        });

        it('should do nothing if already closed', () => {
            expect(comp.opened).to.be.false;
            comp.close();
            expect(comp.opened).to.be.false;
        });

        it('should close the sidenav', () => {
            comp.open();
            expect(comp.opened).to.be.true;
            comp.close();
            expect(comp.opened).to.be.false;
        });
    });

    describe('toggleMode', () => {
        it('should open the sidenav if the value is "alwaysDisplayed"', () => {
            expect(comp.opened).to.be.false;
            comp.toggleMode = 'alwaysDisplayed';
            expect(comp.opened).to.be.true;
        });

        it('should close the sidenav if the value is "toggleRequired"', () => {
            comp.open();
            comp.toggleMode = 'toggleRequired';
            expect(comp.opened).to.be.false;
        });
    });

    describe('defaultSchema', () => {
        it('should return information_schema only if it\'s the only schema available', () => {
            expect(comp.defaultSchema(['information_schema'])).to.equal('information_schema');
        });

        it('should return null if there are no schemas', () => {
            expect(comp.defaultSchema([])).to.be.null;
        });

        it('should return the first non-information_schema schema available', () => {
            // Even though information_schema is first, 'zzz' should be selected
            expect(comp.defaultSchema(['information_schema', 'zzz'])).to.equal('zzz');
        });

        it('should return the schema in the current URL', () => {
            const schema = 'some_schema';
            const urls = [
                ['tables', schema],
                ['tables', schema, 'some_table'],
                ['forms', schema],
                ['forms', schema, 'some_table']
            ];
            for (const url of urls) {
                currentPathStub.returns(url);
                expect(comp.defaultSchema(['aaa', schema])).to.equal(schema);
            }
        });
    });
});
