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
        // toParam() returns a ParamString object that leaves '?' in the query
        // so that we can allow node-mysql2 to sanitize our input
        const query = createQuery(this.squel).toString();

        const result = await this.db.conn!!.execute(query);

        // result[0] is an array of BinaryRows, result[1] is metadata
        return result[0] as SqlRow[];
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
}
