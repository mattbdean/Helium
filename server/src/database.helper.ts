import * as fs from 'fs';
import * as path from 'path';

import * as mysql from 'mysql2/promise';
import * as squelBuilder from 'squel';
import { MysqlSquel, QueryBuilder } from 'squel';

import { SqlRow } from './common/api';

/**
 * Generic interface for mysql2 connection options. See
 * https://github.com/mysqljs/mysql/blob/master/Readme.md#connection-options
 */
export interface DbConf {
    [keys: string]: string;
}

export class Database {
    /** Singleton instance */
    private static instance: Database;

    /** Database connection configuration when working with Travis-CI */
    private static TRAVIS_CONF: DbConf =
        { user: 'user', password: 'password', database: 'helium' };

    private conn: mysql.Connection;
    private connected: boolean;
    private config: DbConf;
    private squel: MysqlSquel = squelBuilder.useFlavour('mysql');

    // Singleton
    private constructor() {}

    /** Ensures a connection */
    public async connect(mode: Mode | DbConf): Promise<void> {
        if (!this.conn) {
            this.config = typeof mode === 'object' ? mode : await Database.createDbConf(mode);
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

    public databaseName(): string { return this.config.database; }

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

    // Singleton
    public static get(): Database {
        if (Database.instance === undefined)
            Database.instance = new Database();

        return Database.instance;
    }

    private static async createDbConf(mode: Mode): Promise<DbConf> {
        // Use a static configuration for Travis
        if (process.env.TRAVIS || process.env.CI)
            return Database.TRAVIS_CONF;

        const confPath = path.resolve(__dirname, 'db.conf.json');
        const parsed = await Database.readJson(confPath);

        const modeProperty = Mode[mode].toLowerCase();
        if (!parsed[modeProperty]) {
            throw new Error(`Database conf (${confPath}) has no property "${modeProperty}"`);
        }

        return parsed[modeProperty];
    }

    /** Promises to read a file and parse its contents as JSON */
    private static async readJson(file: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fs.readFile(file, 'utf8', (err: NodeJS.ErrnoException, data: string) => {
                if (err) return reject(err);
                try {
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            });
        }).then(JSON.parse);
    }
}

export enum Mode {
    PROD,
    TEST
}
