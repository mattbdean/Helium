import { Component, Input, OnInit } from '@angular/core';

import * as _ from 'lodash';

import { Constraint, ConstraintType } from '../common/api';

@Component({
    selector: 'constraint-icons',
    templateUrl: 'constraint-icons.component.html',
    styleUrls: ['constraint-icons.component.scss']
})
export class ConstraintIconsComponent implements OnInit {
    private snowflakeIcon = '/assets/snowflake.svg';
    private keyIcon = '/assets/key.svg';
    private keyChangeIcon = '/assets/key-change.svg';

    public static readonly CONSTRAINT_ORDER: ConstraintType[] = ['primary', 'foreign', 'unique'];

    @Input()
    public constraints: Constraint[];

    public types: ConstraintType[] = [];

    public ngOnInit(): void {
        if (this.constraints === undefined || this.constraints === null)
            this.constraints = [];
        const types = this.constraints.map((c) => c.type);
        if (!_.isEqual(_.uniq(types), types)) {
            throw new Error('Expecting at maximum one Constraint for each ConstraintType');
        }

        const ordered: ConstraintType[] = [];
        for (const t of types) {
            const index = ConstraintIconsComponent.CONSTRAINT_ORDER.indexOf(t);
            if (index < 0)
                throw new Error(`ConstraintType ${t} has no specified order`);
            ordered[index] = t;
        }

        this.types = _.remove(ordered, (t) => !_.isNil(t));
    }

    private iconFor(type: ConstraintType): string {
        switch (type) {
            case 'primary':
                return this.keyIcon;
            case 'foreign':
                return this.keyChangeIcon;
            case 'unique':
                return this.snowflakeIcon;
            default:
                throw new Error(`Unknown constraint type: '${type}'`);
        }
    }

    private infoTextFor(type: ConstraintType): string {
        switch (type) {
            case 'primary':
                return 'this column is a primary key';
            case 'foreign':
                const constraint = this.requireForeignKeyConstraint();
                return `this column references the table ${constraint.foreignTable}` +
                    ` (column ${constraint.foreignColumn})`;
            case 'unique':
                return 'this column contains only unique values';
            default:
                throw new Error(`Unknown constraint type: '${type}'`);
        }
    }

    private fkRouterLink(): string[] {
        const constraint = this.requireForeignKeyConstraint();
        return ['/tables', constraint.foreignTable];
    }

    private requireForeignKeyConstraint(): Constraint {
        const constraint = _.find(this.constraints, (c) => c.type === 'foreign');
        if (constraint === undefined)
            throw new Error('no foreign constraints found');
        return constraint;
    }

    private hasConstraintWithType(type: ConstraintType) {
        return this.types.indexOf(type) >= 0;
    }
}
