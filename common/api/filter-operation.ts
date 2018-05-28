
/**
 * The operation done to some data to filter it from all available data. `lt`,
 * `gt`, and `eq` represent less than, greater than, and equal to, respectively.
 * Right now, `is` and `isnot` only accept `null` for the filter value.
 */
export type FilterOperation = 'lt' | 'gt' | 'eq' | 'is' | 'isnot';
