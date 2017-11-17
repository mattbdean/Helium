export enum ErrorCode {
    // 1xxx -- general
    NO_SUCH_TABLE = 1000,

    // 2xxx -- validation
    ONLY_ONE_MASTER_TABLE = 2000,
    INVALID_PART_TABLE =    2001,
    WRONG_TYPE =            2002,
}
