import { Filter } from '../../common/api';

/**
 * Parameters that must be passed to the API to get data. See TableServe.content
 * for more.
 */
export interface ContentRequest {
    schema: string;
    table: string;
    page?: number;
    limit?: number;
    sort?: string;
    filters?: Filter[];
}
