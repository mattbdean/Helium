import { CompoundConstraint, TableHeader } from '.';
import { TableName } from '../table-name';

/**
 * Metadata about a specific table.
 */
export interface TableMeta {
    /** The schema to which this table belongs */
    schema: string;

    /**
     * The name of the table is it is known to MySQL. This is not the name of
     * the DataJoint class.
     */
    name: string;

    /** Column definitions */
    headers: TableHeader[];

    /** The total amount of rows in this table */
    totalRows: number;

    /**
     * Primary, foreign, and unique constraints. Singular/non-compound
     * constraints are still present here as a "CompoundConstraint" object, but
     * will only have a single constraint.
     */
    constraints: CompoundConstraint[];

    /** Some text, or an empty string of no comment was specified */
    comment: string;

    /**
     * If this is a master table, the names of all part that belong to this
     * table
     */
    parts: TableName[];
}
