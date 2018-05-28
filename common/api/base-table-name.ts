import { TableTier, TransformedName } from '.';

export interface BaseTableName {
    /** The schema which this table belongs to */
    schema: string;

    name: TransformedName;

    masterName: TransformedName | null;

    /**
     * Datajoint-specific data tier. Determined by the first one or two
     * characters of the raw name. See the TableTier docs for more.
     */
    tier: TableTier;
}
