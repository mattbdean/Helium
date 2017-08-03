import { APP_BASE_HREF } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { expect } from 'chai';
import * as _ from 'lodash';
import { InlineSVGModule } from 'ng-inline-svg';

import { Constraint } from '../common/responses';
import { ConstraintIconsComponent } from './constraint-icons.component';
import { ConstraintType } from '../../../server/src/common/responses';

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
                foreignTable: type === 'foreign' ? 'table_' + i : null,
                foreignColumn: type === 'foreign' ? 'column_' + i : null
            });
        }

        return constrs;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                InlineSVGModule,
                RouterModule.forRoot([
                    { path: '', component: ConstraintIconsComponent }
                ])
            ],
            declarations: [ ConstraintIconsComponent ],
            providers: [
                { provide: APP_BASE_HREF, useValue: '/' }
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
                expect(title).to.contain(constr.foreignTable);
                expect(title).to.contain(constr.foreignColumn);
            }
        }
    });
});
