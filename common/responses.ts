export interface ErrorResponse {
    message: string;
    input: any;
}

export interface TableMeta {
    headers: TableHeader[];
    totalRows: number;
    constraints: Constraint[];
    comment: string;
}

export interface PaginatedResponse<T> {
    size: number;
    data: T;
}

export interface SqlRow {
    [columnName: string]: any;
}

export interface TableHeader {
    name: string;

    /** Base type (int, varchar, date, etc.) */
    type: string;

    /** The position at which this column was defined (1 = first col, 2 = second, etc.) */
    ordinalPosition: number;

    /** The exact type the column was created for (varchar(16), int(11), etc.) */
    rawType: string;

    /** True when the type is numeric (int, decimal, double, etc.) */
    isNumber: boolean;

    /** True when the type is textual (text, tinytext, varchar, etc.) */
    isTextual: boolean;

    /** Whether or not data in this column can be null */
    nullable: boolean;

    /**
     * The maximum amount of characters an entry in this column can have.
     * Not null only when this column is textual
     */
    maxCharacters: number | null;

    /** Character set (UTF-8, latin1 etc.) */
    charset: string | null;

    /** Amount of significant figures allowed. Not null only for numeric columns */
    numericPrecision: number | null;

    /**
     * Number of digits to the left/right of the decimal. Not null only for
     * numeric columns
     */
    numericScale: number | null;

    /**
     * Possible values for an enumerated data type. Not null only for columns
     * with the type 'enum'
     */
    enumValues: string[] | null;

    /** Database-level column comment */
    comment: string;
}

export interface Constraint {
    /** Name of the column in the table */
    localColumn: string;

    type: ConstraintType;

    /** The table this constraint references, or null if this is not a foreign key */
    foreignTable: string | null;

    /** The referenced column in [foreignTable], or null if this is not a foreign key */
    foreignColumn: string | null;
}

export type ConstraintType = 'primary' | 'foreign' | 'unique';
