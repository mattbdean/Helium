import * as mysql from 'mysql2/promise';
import * as squelBuilder from 'squel';
import { MysqlSquel, QueryBuilder } from 'squel';

import { SqlRow } from '../common/api';
import { ConfigurationResolver } from './configuration-resolver';
import { ConnectionConf } from './connection-conf.interface';

export class Database {
    private conn: mysql.Connection;
    private connected: boolean;
    private config: ConnectionConf;
    private squel: MysqlSquel = squelBuilder.useFlavour('mysql');

    public constructor(private resolver: ConfigurationResolver) {}

    /** Ensures a connection */
    public async connect(confName: string): Promise<void> {
        if (!this.conn) {
            this.config = await this.resolver.resolve(confName);
            this.conn = await mysql.createConnection(this.config);
            this.connected = true;
        }
    }

    /** Disconnects from the database */
    public disconnect(): Promise<void> {
        // Nothing to do if we're already disconnected
        if (!this.connected) return Promise.resolve();
        return this.conn.end();
    }

    /**
     * Executes the string value of the Squel QueryBuilder and returns the
     * result
     */
    public async execute(createQuery: (squel: MysqlSquel) => QueryBuilder): Promise<SqlRow[]> {
        const query = createQuery(this.squel).toParam();

        const result = await this.conn.execute(query.text, query.values);

        // result[0] is an array of BinaryRows, result[1] is metadata
        return result[0] as SqlRow[];
    }

    /**
     * Executes the given SQL query. If the query has any user input
     * whatsoever, {@link execute} should be used instead.
     */
    public async executeRaw(query: string): Promise<SqlRow[]> {
        const result = await this.conn.execute(query);

        // result[0] is an array of BinaryRows, result[1] is metadata
        return result[0] as SqlRow[];
    }

    /**
     * Executes the given function in the context of a MySQL transaction.
     * Automatically rolls back any changes done to the data if an error occurs.
     * This function is only really needed to ensure that a rootGroup of queries
     * all complete successfully.
     *
     * @param {() => Promise<void>} doWork
     */
    public async transaction(doWork: () => Promise<void>) {
        await this.conn.beginTransaction();
        try {
            await doWork();
            await this.conn.commit();
        } catch (err) {
            await this.conn.rollback();
            throw err;
        }
    }

    /** Escapes a MySQL value (strings, booleans, etc.) */
    public escape(value: any): string {
        return this.conn.escape(value);
    }

    /** Escapes a MySQL identifier (column name, table name, etc.) */
    public escapeId(value: any): string {
        return this.conn.escapeId(value);
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
        return this.squel.rstr(str, ...values);
    }
}
