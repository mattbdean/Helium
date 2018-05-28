/**
 * A response that (unsurprisingly) contains paginated data.
 */
export interface PaginatedResponse<T> {
    /** The size of `data` */
    size: number;

    /** A page of data */
    data: T[];

    /** The total amount of rows available to paginate through */
    totalRows: number;
}
