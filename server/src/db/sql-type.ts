import { TableDataType } from '../common/api';

export class SqlType {
    // https://regexr.com/3sqjf
    /**
     * Picks up 3 distinct members of a SQL type in their own capture group:
     * 
     * 1. Base type (`TINYINT`, `TIMESTAMP`, etc.)
     * 2. Parameter string (in `FOO(1, 2)`, this is `"1, 2"`)
     * 3. Attribute string (in `FOO(1, 2) BAR BAZ`, this is `"BAR BAZ"`)
     * 
     * Only the base type is required.
     */
    private static readonly regex = /^([A-Z]+)(?:\(([A-Z0-9, ']*)\))? ?([A-Z ]+)?$/i;

    /**
     * The raw data type, as found in `INFORMATION_SCHEMA.COLUMNS` under the
     * `COLUMN_TYPE` column.
     */
    public readonly raw: string;

    /** The base data type, e.g. "TINYINT" or "DATETIME" */
    public readonly type: string;

    /**
     * Any data found inside the parenthesis. For example, the parameters for
     * `TINYINT(1)` are `["1"]`. Note that all parameters are represented as
     * strings.
     */
    public readonly params: string[];

    /**
     * Any additional, optional parameters that come after the normal
     * type/parameter declaration. For example, the attributes for
     * `DECIMAL(3, 3) UNSIGNED ZEROFILL` are `["UNSIGNED", "ZEROFILL"]`.
     */
    public readonly attributes: string[];

    public get tableDataType(): TableDataType {
        // This is probably the ugliest code I've written in recent history.
        const type = this.type.toLowerCase();
        if (type.endsWith('int')) {
            // TINYINT(1) is actually a boolean
            return type === 'tinyint' && this.params[0] === '1' ? 'boolean' : 'integer';
        }

        if (type === 'bit') {
            // BIT(1) is a boolean, BIT(N) is an integer
            return this.params[0] === '1' ? 'boolean' : 'integer';
        }

        if (type === 'bool' || type === 'boolean')
            return 'boolean';
        if (type === 'year')
            return 'integer';
        if (type === 'decimal' || type === 'dec' || type === 'numeric' ||
            type === 'fixed' || type === 'float' || type === 'double')
            return 'float';
        if (type === 'date')
            return 'date';
        if (type === 'datetime' || type === 'timestamp')
            return 'datetime';
        if (type.includes('char') || type.includes('text'))
            return 'string';
        if (type.endsWith('binary') || type.endsWith('blob'))
            return 'blob';
        if (type === 'enum')
            return 'enum';
        if (type === 'time')
            return 'time';

        throw new Error(`Cannot determine a TableDataType for the MySQL type "${this.type}"`);
    }

    /** True if the TableDataType is displayed as a number */
    public get numeric(): boolean {
        return this.tableDataType === 'float' || this.tableDataType === 'integer';
    }

    /** True if the TableDataType is displayed with non-numbers */
    public get textual(): boolean {
        return !this.numeric;
    }

    public constructor(data: SqlTypeParams | string) {
        const params = typeof data === 'object' ? data : SqlType.parseSqlType(data);

        this.raw = params.raw;
        this.type = params.type;
        this.params = params.params;
        this.attributes = params.attributes;
    }

    private static parseSqlType(raw: string): SqlTypeParams {
        const matches = SqlType.regex.exec(raw);
        if (matches === null)
            throw new Error('Did not match regex: ' + raw);
        
        // matches[0] is the text that was matched. matches[1] to
        // matches[matches.length - 1] are all the capture groups

        const params = matches[2] === undefined || matches[2].trim().length === 0 ? [] :
            matches[2].split(',').map((p) => p.trim());
        
        const attributes = matches[3] === undefined || matches[3].trim().length === 0 ? [] :
            matches[3].split(' ').map((a) => a.trim());

        return {
            raw,
            type: matches[1],
            params,
            attributes
        };
    }
}

export interface SqlTypeParams {
    raw: string;
    type: string;
    params: string[];
    attributes: string[];
}
