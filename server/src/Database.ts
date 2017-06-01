import * as fs from 'fs';
import * as path from 'path';

import * as mysql from 'mysql2/promise';

/**
 * Generic interface for mysql2 connection options. See
 * https://github.com/mysqljs/mysql/blob/master/Readme.md#connection-options
 */
interface DbConf {
    [keys: string]: string;
}

export class Database {
    /** Singleton instance */
    private static instance: Database;

    /** Database connection configuration when working with Travis-CI */
    private static TRAVIS_CONF: DbConf =
        { user: 'travis', password: 'password', database: 'test' };

    private internalConn: any;

    // Singleton
    private constructor() {}

    /** Ensures a connection */
    public async connect(mode: Mode): Promise<void> {
        if (!this.internalConn) {
            const conf = await Database.createDbConf(mode);

            this.internalConn = await mysql.createConnection(conf);
        }
    }

    /** Disconnects from the database */
    public disconnect(): Promise<void> {
        // Nothing to do if we're already disconnected
        if (this.internalConn === null) return Promise.resolve();
        return this.internalConn.end();
    }

    // Expose internalConn as a getter property so it can be accessed like
    // Database.get().conn
    /**
     * A node-mysql2 PromiseConnection. Null if not connected
     */
    public get conn(): any | null { return this.internalConn; }

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
        const parsed = await readJson(confPath);

        const modeProperty = Mode[mode].toLowerCase();
        if (!parsed[modeProperty]) {
            throw new Error(`Database conf (${confPath}) has no property "${modeProperty}"`);
        }

        return parsed[modeProperty];
    }
}

export enum Mode {
    PROD,
    TEST
}

/** Promises to read a file and parse its contents as JSON */
const readJson = (file: string): Promise<any> =>
    new Promise<any>((resolve, reject) => {
        fs.readFile(file, 'utf8', (err: NodeJS.ErrnoException, data: string) => {
            if (err) return reject(err);
            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(err);
            }
        });
    });
