import { ConstraintType } from ".";

export interface Constraint {
    /** Name of the column in the table */
    localColumn: string;

    type: ConstraintType;

    /**
     * If this is a foreign key constraint, the primary key this constraint
     * references. Null if not a foreign key.
     */
    ref: {
        schema: string,
        table: string,
        column: string
    } | null;
}
