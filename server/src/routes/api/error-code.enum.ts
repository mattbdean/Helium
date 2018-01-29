export type ErrorCode =
    // General
    'MALFORMED_JSON' |
    'WRONG_TYPE' |
    'INVALID_PAGE' |
    'INVALID_LIMIT' |

    // Filters
    'INVALID_FILTER' |

    // Database
    'NO_SUCH_TABLE' |
    'ONLY_ONE_MASTER_TABLE' |
    'INVALID_PART_TABLE';
