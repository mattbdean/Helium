import { BaseTableName, TableTier } from './api';
import { TABLE_TIER_PREFIX_MAPPING } from './constants';
import { TableNameParams } from './table-name-params.interface';

const masterPartSeparator = '__';

export class TableName implements BaseTableName {
    public readonly schema: string;
    public readonly rawName: string;
    public readonly tier: TableTier;
    public readonly cleanName: string;
    public readonly masterRawName: string | null;

    public constructor(schema: string, parameters: string | TableNameParams) {
        const resolved = TableName.resolve(parameters);
        this.schema = schema;
        this.rawName = resolved.rawName;
        this.tier = resolved.tier;
        this.cleanName = resolved.cleanName;
        this.masterRawName = resolved.masterRawName;
    }

    public isPartTable() { return this.masterRawName !== null; }

    private static resolve(parameters: string | TableNameParams): TableNameParams {
        if (typeof parameters === 'object')
            return parameters;

        const sqlName = parameters as string;

        // Assume the table is a manual table and therefore has no prefix
        let tier: TableTier = 'manual';
        let startTrim = 0;

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

        const masterName = identifiers[0];

        for (const prefix of Object.keys(TABLE_TIER_PREFIX_MAPPING)) {
            if (masterName.startsWith(prefix)) {
                startTrim = prefix.length;
                tier = TABLE_TIER_PREFIX_MAPPING[prefix];
                break;
            }
        }

        const isPartTable = identifiers.length > 1;

        const cleanName = isPartTable ?
            // The second element in the identifiers array is the name of the part table
            identifiers[1] :
            // This is a master table, remove the prefix from the masterName
            (startTrim === 0 ? masterName : masterName.substring(startTrim));

        const masterRawName = isPartTable ? identifiers[0] : null;

        return {
            rawName: sqlName,
            tier,
            cleanName,
            masterRawName
        };
    }
}
