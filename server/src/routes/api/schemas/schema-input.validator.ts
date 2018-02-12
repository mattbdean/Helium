import * as BaseJoi from 'joi';
import { AnySchema, ArraySchema, ObjectSchema } from 'joi';
import * as JoiDateExtensions from 'joi-date-extensions';
import * as _ from 'lodash';
import * as moment from 'moment';
import { TableHeader } from '../../../common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../../common/constants';
import { TableInsert } from '../../../common/table-insert.interface';
import { TableName } from '../../../common/table-name.class';
import { ErrorCode } from '../error-code.enum';
import { ValidationError } from '../validation-error';
import { SchemaDao } from './schema.dao';

/**
 * This class attempts to validate input to be inserted into the database.
 *
 * An "entry" to a table is roughly defined like this:
 *
 * <pre>
 * {
 *   column1: some value,
 *   column2: some value,
 *   ...
 * }
 * </pre>
 *
 * The values allowed for each key depend on the data type of the header. See
 * {@link #schemaForHeader} for more.
 *
 * Key names are limited to the names of the table's columns. Unknown keys are
 * forbidden.
 *
 * A valid input is an object that maps table names to an array of table
 * entries. A master table is allowed to have exactly one entry. A part table
 * is allowed to have zero or more entries, but all specified part tables must
 * belong to the master table. No more than one master table is allowed per
 * input object.
 *
 * As an example consider two tables: `foo`, with a single column `primary_key`,
 * and `foo__bar`, a part table belonging to `foo` with columns `pk`, `foo_pk`.
 * Assuming all columns are integers, this is a valid input object:
 *
 * <pre>
 * {
 *   foo: [
 *     { primary_key: 1 }
 *   ],
 *   foo__bar: [
 *     { pk: 1, foo_pk: 1 },
 *     { pk: 2, foo_pk: 1 }
 *   ]
 * }
 * </pre>
 *
 * This class only validates the shape of the input object. Logical validation
 * (e.g. constraint validation) is handled by the SQL engine.
 *
 * Note that there is some leniency with regard to input type. For boolean
 * values, the string 'true' will be converted to the boolean `true` upon
 * successful validation. Numbers are converted similarly. This functionality is
 * handled by Joi, not by this class directly. See the API for Joi's validate()
 * method for more, specifically `options.convert`. Any Date objects are
 * converted into the proper MySQL format.
 */
export class TableInputValidator {
    private static joi = BaseJoi.extend(JoiDateExtensions);

    public constructor(private helper: SchemaDao) {}

    /**
     * Attempts to validate some input data as described in the class
     * documentation.
     *
     * Validation occurs in two stages: pre-Joi and post-Joi. Pre-Joi
     * validation is the most basic. It
     *
     * 1. ensures the input is a defined, non-null object,
     * 2. ensures there is exactly one master table
     * 3. ensures any other table specified is a part tables belonging to the
     *    master table.
     *
     * If a validation error occurs at this stage, a ValidationError will be
     * thrown with an appropriate code and message.
     *
     * Once pre-Joi validation has passed, a Joi schema is constructed with the
     * data gathered from the initial validation. Any Error thrown because of
     * Joi will have the `isJoi` and `details` properties.
     */
    public async validate(db: string, data: any): Promise<TableInsert> {
        if (data === null || data === undefined || typeof data !== 'object')
            throw new ValidationError('Expecting a defined, non-null object, got ' + data,
                'WRONG_TYPE');

        // Convert all keys to TableName objects
        const tableNames = Object.keys(data).map((n) => new TableName(db, n.toString()));
        const [parts, masters] = _.partition(tableNames, (n) => n.isPartTable());

        // Make sure only one master table was specified
        if (masters.length !== 1)
            throw new ValidationError(
                'Expecting exactly 1 master table, got ' + masters.length,
                'ONLY_ONE_MASTER_TABLE');

        const masterTable = masters[0];

        // Make sure each part table specified belongs to the master table
        for (const part of parts)
            // We created `parts` by checking if it was a part table,
            // part.masterName is guaranteed to be non-null here
            if (part.masterName!!.raw !== masterTable.name.raw)
                throw new ValidationError('Part table data must be inserted ' +
                    'with the master it belongs to', 'INVALID_PART_TABLE');

        // Fetch all metadata belonging to all the tables here. The headers for
        // tableNames[i] are located at allHeaders[i].
        const allHeaders: TableHeader[][] = await Promise.all(
            tableNames.map((name: TableName) => this.helper.headers(db, name.name.raw), this));

        const keys = tableNames.map((n) => n.name.raw);
        const values = tableNames.map((n, index) => {
            // Allow multiple entries only if the table is a part table
            return TableInputValidator.schemaForTableArray(allHeaders[index], n);
        });

        const schema = TableInputValidator.joi.compile(_.zipObject(keys, values));
        const result = TableInputValidator.joi.attempt(data, schema);

        // The headers at tableNames[i] are located at allHeaders[i]
        const headerMap = _.zipObject(
            tableNames.map((n) => n.name.raw),
            allHeaders
        );

        return TableInputValidator.reformatDates(result, headerMap);
    }

    /**
     * Creates an ArraySchema that accepts table entries whose headers are given.
     * If `allowMultiple` is false, the array will only be valid if one entry is
     * given.
     */
    public static schemaForTableArray(headers: TableHeader[], name: TableName): ArraySchema {
        const contentsSchema = TableInputValidator.schemaForTable(headers);

        let schema = TableInputValidator.joi.array().items(contentsSchema);
        if (!name.isPartTable())
            schema = schema.length(1);

        return schema;
    }

    /**
     * Creates a schema that validates an object being treated as input to an
     * insert operation for a table with the provided headers. If a table has
     * two columns `foo` and `bar`, then this function would return a schema
     * that requires the input object to have this shape:
     *
     * {
     *   foo: <some value>,
     *   bar: <some value>
     * }
     *
     * The allowed values for `foo` and `bar` depends on their headers. See
     * {@link #schemaForHeader} for more information. The resulting schema will
     * not allow undefined values.
     */
    public static schemaForTable(headers: TableHeader[]): ObjectSchema {
        if (headers.length === 0)
            throw new Error('Expected table to have at least one header');

        const keys = headers.map((h) => h.name);
        const values = headers.map(TableInputValidator.schemaForHeader);

        return TableInputValidator.joi.compile(_.zipObject(keys, values));
    }

    /**
     * Creates a schema that validates the value of a particular header. For
     * example, a header representing an unsigned integer column would create
     * a schema that accepts only positive integers when given to this function.
     *
     * Dates are expected to have the format 'YYYY-MM-DD' and similarly,
     * datetimes should have the format 'YYYY-MM-DD HH:mm:ss'.
     *
     * Most data types are pretty straightforward, (var)char headers produce
     * string-based schemas, tinyint(1) headers produce boolean schemas etc.
     *
     * Blobs are a special case, however. Due to the unnecessary security risk
     * of accepting blobs at face value, blobs are forbidden unless the column
     * is nullable and the value is null.
     *
     * Note that there is some leniency with regard to input type. For boolean
     * values, the string 'true' will be converted to the boolean `true` upon
     * successful validation. Numbers, dates, and datetimes are converted
     * similarly. This functionality is handled by Joi, not by this method
     * directly. See the API for Joi's validate() method for more, specifically
     * `options.convert`.
     */
    public static schemaForHeader(h: TableHeader): AnySchema {
        let schema: AnySchema;
        switch (h.type) {
            case 'string':
                schema = TableInputValidator.joi.string()
                    .min(0)
                    .max(h.maxCharacters !== null ? h.maxCharacters : Infinity);
                break;
            case 'integer':
            case 'float':
                // TODO: Handle maximum values for integers/floats
                let base = TableInputValidator.joi.number();
                if (!h.signed) {
                    base = base.min(0);
                }
                if (h.type === 'integer')
                    base = base.integer();
                schema = base;
                break;
            case 'date':
                schema = TableInputValidator.joi.date().format('YYYY-MM-DD');
                break;
            case 'datetime':
                schema = TableInputValidator.joi.date().format('YYYY-MM-DD HH:mm:ss');
                break;
            case 'boolean':
                schema = TableInputValidator.joi.boolean();
                break;
            case 'enum':
                schema = TableInputValidator.joi.only(h.enumValues!!);
                break;
            case 'blob':
                // Only allow a value of null to be inserted when the header
                // explicitly marks it as nullable. Accepting blobs could be
                // very dangerous and isn't necessary right now.
                const allowedValues = h.nullable ? [null] : [];
                schema = TableInputValidator.joi.only(allowedValues);
                break;
            default:
                throw Error('Unknown data type: ' + h.type);
        }

        // No undefined values
        schema = schema.required();

        // Make all non-nullable properties required. Blob nullability is
        // already handled.
        if (h.type !== 'blob') {
            if (h.nullable) {
                schema = schema.allow(null);
            } else {
                schema = schema.disallow(null);
            }
        }

        return schema;
    }

    /**
     * This function transforms any date values to properly formatted MySQL
     * date or datetime strings.
     */
    private static reformatDates(result: TableInsert, headers: { [tableName: string]: TableHeader[] }): TableInsert {
        const formatted = _.clone(result);
        // Iterate through the table names
        for (const tableName of Object.keys(formatted)) {
            // Iterate through each table entry with that name
            for (const entryIndex of _.range(formatted[tableName].length)) {
                // Iterate through every key-value-pair in that entry
                for (const headerName of Object.keys(formatted[tableName][entryIndex])) {
                    // Test for any date objects
                    if (formatted[tableName][entryIndex][headerName] instanceof Date) {
                        const header = headers[tableName].find((h) => h.name === headerName);
                        if (header === undefined)
                            throw new Error(`Could not find header ${tableName}.${headerName}`);

                        // Find the appropriate output format
                        let format: string;
                        switch (header.type) {
                            case 'date':
                                format = DATE_FORMAT;
                                break;
                            case 'datetime':
                                format = DATETIME_FORMAT;
                                break;
                            default:
                                throw new Error(`Not a date or datetime header: ` +
                                    `${tableName}.${headerName}`);
                        }

                        // Reformat the date into a MySQL string
                        formatted[tableName][entryIndex][headerName] =
                            moment(formatted[tableName][entryIndex][headerName])
                                .format(format);
                    }
                }
            }
        }

        return formatted;
    }
}
