import { TableTier } from './api';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const TABLE_TIER_PREFIX_MAPPING: { [prefix: string]: TableTier } = {
    '#': 'lookup',
    '__': 'computed',
    '_': 'imported',
    '~': 'hidden'
};

export const BLOB_STRING_REPRESENTATION = '<blob>';

/**
 * A special MySQL constant. When the default value of a datetime or timestamp
 * column is this value, the current timestamp is inserted in place of an
 * explicitly defined value for that column.
 */
export const CURRENT_TIMESTAMP = 'CURRENT_TIMESTAMP';
