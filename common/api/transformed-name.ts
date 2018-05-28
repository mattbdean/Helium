
/**
 * The name of a table after being transformed from its MySQL name in snake_case
 * to its name in Python/DataJoint in UpperCamelCase.
 */
export interface TransformedName {
    /** MySQL name */
    raw: string;

    /** DataJoint name */
    clean: string;
}
