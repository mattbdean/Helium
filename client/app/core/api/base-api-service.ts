import { Observable } from 'rxjs';
import { PaginatedResponse, SqlRow, TableInsert, TableMeta } from '../../common/api';
import { TableName } from '../../common/table-name';
import { ContentRequest } from './content-request';

export interface BaseApiService {
    /**
     * Requests the schemas available to the user. Emits a string array of
     * schema names when successful.
     */
    schemas(): Observable<string[]>;

    /** Fetches a list of all tables in the given schema */
    tables(schema: string): Observable<TableName[]>;

    /** Fetches meta for a given table */
    meta(schema: string, table: string): Observable<TableMeta>;

    /** Fetches paginated data from a given table */
    content(req: ContentRequest): Observable<PaginatedResponse<SqlRow>>;

    pluck(schema: string, table: string, selectors: { [key: string]: string }): Observable<TableInsert>;

    columnValues(schema: string, table: string, column: string): Observable<any[]>;

    /**
     * Attempts to add a row to the database for a given table. The table must
     * exist and the body must have the shape of a SqlRow.
     */
    submitRow(schema: string, body: TableInsert): Observable<null>;
}
