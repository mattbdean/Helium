import { TableTier } from './api';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const TABLE_TIER_PREFIX_MAPPING: { [prefix: string]: TableTier } = {
    '#': 'lookup',
    '__': 'computed',
    '_': 'imported',
    '~': 'hidden'
};

export const TEST: Readonly<string> = Object.freeze('hello');
