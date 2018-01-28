export type ErrorCode =
    // General
    'MALFORMED_JSON' |
    'WRONG_TYPE' |

    // Filters
    'INVALID_FILTER' |

    // Database
    'NO_SUCH_TABLE' |
    'ONLY_ONE_MASTER_TABLE' |
    'INVALID_PART_TABLE';
