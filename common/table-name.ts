import { BaseTableName, TableTier, TransformedName } from './api';
import { TABLE_TIER_PREFIX_MAPPING } from './constants';
import {
    TableNameParams,
} from './table-name-params';

const masterPartSeparator = '__';

export class TableName implements BaseTableName {
    public readonly schema: string;
    public readonly name: TransformedName;
    public readonly masterName: TransformedName | null;
    public readonly tier: TableTier;

    public constructor(schema: string, parameters: string | TableNameParams) {
        const resolved = TableName.resolve(parameters);
        this.schema = schema;
        this.name = resolved.name;
        this.tier = resolved.tier;
        this.masterName = resolved.masterName;
    }

    public isPartTable() { return this.masterName !== null; }

    /**
     * Tests if the given raw table name was possibly created by DataJoint.
     * According to [1], DataJoint class names must be UpperCamelCase. That name
     * is transformed to snake_case for DB purposes. A Python identifier
     * (v2, not v3), is composed of letters (upper and lower), underscores, and
     * except for the first character, numbers ([2]). Therefore, a DataJoint table
     * name includes only its data tier prefix, lowercase letters, and numbers.
     * 
     * [1] https://docs.datajoint.io/data-definition/Create-tables.html#valid-class-names,
     * [2] https://docs.python.org/3/reference/lexical_analysis.html#identifiers
     */
    public static isDataJointName(raw: string): boolean {
        return /^[_{1,2}~#]?[a-z0-9_]+$/.test(raw);
    }

    private static resolve(parameters: string | TableNameParams): TableNameParams {
        if (typeof parameters === 'object')
            return parameters;

        const sqlName = parameters as string;

        // Not a DJ name, nothing to do here
        if (!TableName.isDataJointName(sqlName)) {
            return {
                tier: 'unknown',
                name: {
                    raw: sqlName,
                    clean: sqlName
                },
                masterName: null
            };
        }

        let identifiers = [sqlName];
        if (sqlName.includes(masterPartSeparator)) {
            // Remember if the name starts with the master-part separator (as is the
            // case with computed tables)
            const startsWithSeparator = sqlName.startsWith(masterPartSeparator);

            // Don't include the separator at the beginning
            const tempName = startsWithSeparator ? sqlName.substring(masterPartSeparator.length) : sqlName;

            // Identify the master and part names
            identifiers = tempName.split(masterPartSeparator);

            // Add the prefix back to the master name, if applicable
            if (startsWithSeparator)
                identifiers[0] = masterPartSeparator + identifiers[0];

            // Make sure we only have one master name and one part name in our array.
            // If given a table name of 'one__two__three', we want to report that
            // the master name is 'one' and the part name is 'two__three'.
            if (identifiers.length > 1) {
                const partName = identifiers.slice(1).join(masterPartSeparator);
                identifiers = [identifiers[0], partName];
            }
        }

        const masterRawName = identifiers[0];

        // Assume the table is a manual table and therefore has no prefix
        let tier: TableTier = 'manual';
        let tierPrefix: string = '';

        // Try to identify what tier of table this is and what that tier's
        // prefix is.
        for (const prefix of Object.keys(TABLE_TIER_PREFIX_MAPPING)) {
            if (masterRawName.startsWith(prefix)) {
                tier = TABLE_TIER_PREFIX_MAPPING[prefix];
                tierPrefix = prefix;
                break;
            }
        }

        const isPartTable = identifiers.length > 1;

        const masterName = isPartTable ?
            // The master raw name will be the first element if this is a part
            // table
            TableName.transformName(identifiers[0], tierPrefix) : null;

        const name = TableName.transformName(
            // The 2nd element in the array will be the part table name
            identifiers[isPartTable ? 1 : 0],
            // The part table name has no prefix
            isPartTable ? '' : tierPrefix,
            // The final raw name should be the one used in SQL (aka the
            // original name given to us)
            parameters);

        return {
            name,
            masterName,
            tier,
        };
    }

    /** Transforms snake_case into CamelCase and removes any DataJoint tier prefixes. */
    private static transformName(raw: string, prefix: string, finalRawOverride: string = raw): TransformedName {
        // Split each part up by finding as many consecutive underscores as
        // possible
        const prefixRemoved = raw.slice(prefix.length);
        const parts = prefixRemoved.split(/_+/);

        return {
            raw: finalRawOverride,
            // Capitalize each word and join then together
            clean: parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
        };
    }
}
