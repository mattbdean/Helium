import { Database } from './Database';

import { MysqlSquel, QueryBuilder } from 'squel';
import * as squelBuilder from 'squel';
import { SqlRow } from './common/api';

import * as mysql from 'mysql2';

/**
 * Assists with preparing and executing SQL queries.
 */
export class QueryHelper {
    private db: Database;
    private squel: MysqlSquel = squelBuilder.useFlavour('mysql');

    public constructor() {
        this.db = Database.get();
    }

    /**
     * Executes the string value of the Squel QueryBuilder and returns the
     * result
     */
    public async execute(createQuery: (squel: MysqlSquel) => QueryBuilder): Promise<SqlRow[]> {
        const query = createQuery(this.squel).toString();

        const result = await this.db.conn!!.execute(query);

        // result[0] is an array of BinaryRows, result[1] is metadata
        return result[0] as SqlRow[];
    }

    /**
     * Executes the given function in the context of a MySQL transaction.
     * Automatically rolls back any changes done to the data if an error occurs.
     * This function is only really needed to ensure that a group of queries
     * all complete successfully.
     *
     * @param {() => Promise<void>} doWork
     */
    public async transaction(doWork: () => Promise<void>) {
        await this.db.conn!!.beginTransaction();
        try {
            await doWork();
            await this.db.conn!!.commit();
        } catch (err) {
            await this.db.conn!!.rollback();
            throw err;
        }
    }

    public databaseName() {
        return this.db.dbName();
    }

    public escape(value: any): string {
        return this.db.conn!!.escape(value);
    }

    public escapeId(value: any): string {
        return this.db.conn!!.escapeId(value);
    }

    public plainString(str: string, ...values: any[]) {
        return this.squel.rstr(str, ...values);
    }
}
