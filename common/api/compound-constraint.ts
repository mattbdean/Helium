import { Constraint, ConstraintType } from '.';

/**
 * A compound constraint is made up of several individual constraints. Each
 * constraint in the `constraints` array is located at its index. For example,
 * if a constraint has an index of 2, it will appear in index 2 of the
 * constraints array.
 */
export interface CompoundConstraint {
    /**
     * The name of the constraint. For primary keys, this will be `PRIMARY`. For
     * unique constraints, this will be the name of the column, and for foreign
     * keys that aren't assigned an explicit name, this will usually be
     * something like `{table_name}_ibfk_{index}`.
     */
    name: string;

    type: ConstraintType;

    /** The individual constraints that make up this compound constraint */
    constraints: Constraint[];
}
