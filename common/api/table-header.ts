import { DefaultValue, TableDataType } from '.';

export interface TableHeader {
    name: string;

    /** Base data type */
    type: TableDataType;

    /** The exact type the column was created with (varchar(16), int(11), etc.) */
    rawType: string;

    /** True when the type is numeric (int, decimal, double, etc.) */
    isNumerical: boolean;

    /** True when the type is textual (text, tinytext, varchar, date, etc.) */
    isTextual: boolean;

    /** The position at which this column was defined (1 = first col, 2 = second, etc.) */
    ordinalPosition: number;

    /**
     * Only applicable for numerical data types. An unsigned number cannot be
     * negative.
     */
    signed: boolean;

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

    /** The name of the table to which this column belongs. */
    tableName: string;

    /** A value that will be used if no explicit value is set on insertion time. */
    defaultValue: DefaultValue;
}
