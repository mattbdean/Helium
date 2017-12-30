import { APP_BASE_HREF } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { expect } from 'chai';
import * as _ from 'lodash';
import { InlineSVGModule } from 'ng-inline-svg';

import { HttpClientModule } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';
import { Constraint, ConstraintType } from '../common/api';
import { ConstraintIconsComponent } from './constraint-icons.component';

describe('ConstraintIconsComponent', () => {
    let fixture: ComponentFixture<ConstraintIconsComponent>;
    let comp: ConstraintIconsComponent;

    const createConstraints = (types: ConstraintType[]): Constraint[] => {
        const constrs: Constraint[] = [];
        for (let i = 0; i < types.length; i++) {
            const type = types[i];
            constrs.push({
                type,
                localColumn: 'constr_' + i,
                ref: type !== 'foreign' ? null : {
                    schema: 'schema',
                    table: 'table_' + i,
                    column: 'column_' + i
                }
            });
        }

        return constrs;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                InlineSVGModule,
                RouterTestingModule,
                HttpClientModule
            ],
            declarations: [ ConstraintIconsComponent ],
            providers: [
                { provide: APP_BASE_HREF, useValue: '/' },
            ]
        });

        fixture = TestBed.createComponent(ConstraintIconsComponent);
        comp = fixture.componentInstance;
    });

    it('should display nothing when given no Constraints', () => {
        comp.constraints = [];
        fixture.detectChanges();
        expect(comp.types).to.deep.equal([]);
        expect(fixture.debugElement.queryAll(By.css('.header-icon'))).to.deep.equal([]);
    });

    it('should display a primary key icon when given only a PK Constraint', () => {
        // Give the component only one constraint
        comp.constraints = createConstraints(['primary']);
        fixture.detectChanges();

        // Should update after first change (ngOnInit is called)
        expect(comp.types).to.deep.equal(['primary']);

        const icons = fixture.debugElement.queryAll(By.css('.header-icon'));
        expect(icons).to.have.lengthOf(1);
        expect(icons[0].attributes['data-constraint-type']).to.equal('primary');
    });

    it('should always display a icons in the same order', () => {
        const types = ConstraintIconsComponent.CONSTRAINT_ORDER;
        comp.constraints = createConstraints(types);
        fixture.detectChanges();

        expect(comp.types).to.deep.equal(types);

        comp.constraints = _.reverse(comp.constraints);
        fixture.detectChanges();
        expect(comp.types).to.deep.equal(types);
    });

    it('should give titles to each header-icon', () => {
        const types = ConstraintIconsComponent.CONSTRAINT_ORDER;
        comp.constraints = createConstraints(types);
        fixture.detectChanges();

        const icons = fixture.debugElement.queryAll(By.css('.header-icon'));
        expect(icons).to.have.lengthOf(comp.constraints.length);

        // Make sure each title at least mentions
        for (let i = 0; i < types.length; i++) {
            const constr = comp.constraints[i];
            const title = icons[i].nativeElement.title;

            if (types[i] !== 'foreign') {
                // At the very least, make sure the title for non-FK constraints
                // mention their type
                expect(title).to.contain(types[i]);
            } else {
                // Make sure titles for foreign key constraints mention what
                // they reference
                expect(title).to.contain(constr.ref!!.table);
                expect(title).to.contain(constr.ref!!.column);
            }
        }
    });

    it('should use a routerLink for foreign key icons', () => {
        comp.constraints = createConstraints(['foreign']);
        const constr = comp.constraints[0];
        fixture.detectChanges();

        const icon = fixture.debugElement.query(By.css('.header-icon'));
        expect(icon).to.not.be.null;

        expect(icon.nativeElement.getAttribute('href')).to.equal(`/tables/${constr.ref!!.schema}/${constr.ref!!.table}`);
    });
});
