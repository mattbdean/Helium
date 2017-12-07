import { Pool, PoolConnection } from 'promise-mysql';
import * as squelBuilder from 'squel';
import { MysqlSquel, QueryBuilder } from 'squel';
import { SqlRow } from '../common/api';

export class QueryHelper {
    private static squel: MysqlSquel = squelBuilder.useFlavour('mysql');

    public constructor(private pool: Pool) {}

    /**
     * Executes the string value of the Squel QueryBuilder and returns the
     * result
     */
    public async execute(createQuery: (squel: MysqlSquel) => QueryBuilder, conn?: PoolConnection): Promise<SqlRow[]> {
        const query = createQuery(QueryHelper.squel).toParam();

        const result = await (conn || this.pool).query(query.text, query.values);

        // result[0] is an array of BinaryRows, result[1] is metadata
        return result as SqlRow[];
    }

    /**
     * Executes the given SQL query. If the query has any user input
     * whatsoever, {@link execute} should be used instead to reduce the chance
     * of vulnerabilities
     *
     * @param query The SQL string to execute
     * @param conn If provided, this specific connection will be used to execute
     *             the query instead of letting the connection pool
     *             automatically pick one
     */
    public async executeRaw(query: string, conn?: PoolConnection): Promise<SqlRow[]> {
        return await (conn || this.pool).query(query);
    }

    /**
     * Executes the given function in the context of a MySQL transaction.
     * Automatically rolls back any changes done to the data if an error occurs.
     * This function is only really needed to ensure that a rootGroup of queries
     * all complete successfully.
     *
     * @param {() => Promise<void>} doWork
     */
    public async transaction(doWork: (conn: PoolConnection) => Promise<void>) {
        const conn = await this.pool.getConnection();

        await conn.beginTransaction();
        try {
            await doWork(conn);
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            // Using conn.release() doesn't work
            this.pool.releaseConnection(conn);
        }
    }

    /** Escapes a MySQL value (strings, booleans, etc.) */
    public escape(value: any): string {
        return this.pool.escape(value);
    }

    /** Escapes a MySQL identifier (column name, table name, etc.) */
    public escapeId(value: any): string {
        return this.pool.escapeId(value);
    }

    /**
     * Alias to squel.rstr. When used as a parameter in a squel query builder,
     * this string will appear as is inside the final query. For example:
     *
     * squel.update()
     *     .table('students')
     *     .set('modified', database.plainString('NOW()')
     *     .toString()
     *
     * // UPDATE students SET modified = NOW()
     */
    public plainString(str: string, ...values: any[]) {
        return QueryHelper.squel.rstr(str, ...values);
    }
}
