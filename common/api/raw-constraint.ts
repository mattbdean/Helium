import { Constraint } from '.';

/**
 * A constraint as identified from `INFORMATION_SCHEMA`. Contains information
 * not relevant to the API consumer and only used to create
 * `CompoundConstraint`s.
 */
export interface RawConstraint extends Constraint {
    /**
     * The name of the constraint, as reported by MySQL. Primary keys usually
     * have the name 'PRIMARY' while foreign key constraints have unique names
     * within their schema.
     */
    name: string;

    /**
     * The index of this particular constraint within the compound constraint.
     * If not a compound constraint, this will always be 0.
     */
    index: number;
}
