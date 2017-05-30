import * as fs from 'fs';
import * as path from 'path';

import * as chalk from 'chalk';
import * as Joi from 'joi';
import * as Sequelize from 'sequelize';
import { SyncOptions } from 'sequelize';

import { importAll } from './models';

interface DbConf {
    username: string;
    password: string;
    database: string;
    host?: string;
}

const dbConfSchema = Joi.object().keys({
    username: Joi.string(),
    password: Joi.string(),
    database: Joi.string(),
    host: Joi.string().regex(/[a-z.]+/i)
}).requiredKeys('username', 'password', 'database');

export class Database {
    private static instance: Database;

    private internalSql: Sequelize.Sequelize;

    // Singleton
    private constructor() {}

    public async connect(mode: Mode): Promise<void> {
        if (this.internalSql === undefined) {
            const conf = await Database.createDbConf(mode);

            this.internalSql = new Sequelize(conf.database, conf.username, conf.password, {
                host: conf.host || 'localhost',
                dialect: 'mysql',
                logging: (str) => {
                    process.stdout.write(chalk.blue('[SQL] ') + str + '\n');
                }
            });
        }

        // Cast to any to tell the TypeScript compiler to f*** off and let us
        // use Bluebird even though their typing definitions are ever so
        // slightly different from lib.es6.d.ts
        return this.sequelize.authenticate() as any;
    }

    /**
     * Imports all models and syncs
     * @param opts Any options to pass to sequelize.sync()
     * @returns {Promise<any>}
     */
    public async init(opts?: SyncOptions): Promise<void> {
        await importAll(this.sequelize);
        return this.sequelize.sync(opts) as any;
    }

    public disconnect() {
        this.internalSql.close();
    }

    public get sequelize() { return this.internalSql; }

    public static get(): Database {
        if (Database.instance === undefined)
            Database.instance = new Database();

        return Database.instance;
    }

    /** Convenience function for Database.get().sequelize */
    public static sequelize(): Sequelize.Sequelize {
        return Database.get().sequelize;
    }

    private static async createDbConf(mode): Promise<DbConf> {
        if (process.env.TRAVIS)
            // Set in conjunction with .travis.yml
            return { username: 'travis', password: 'password', database: 'test' };

        const confPath = path.resolve(__dirname, 'db.conf.json');
        const parsed = await readJson(confPath);

        const modeProperty = Mode[mode].toLowerCase();
        if (!parsed[modeProperty]) {
            throw new Error(`Database conf (${confPath}) has no property "${modeProperty}"`);
        }

        const result = Joi.validate(parsed[modeProperty], dbConfSchema);
        if (result.error !== null) {
            throw new Error(`Invalid database configuration (${confPath}): ${result.error}`);
        }

        return parsed[modeProperty];
    }
}

export enum Mode {
    PROD,
    TEST
}

const readJson = (file): Promise<any> =>
    new Promise<DbConf>((resolve, reject) => {
        fs.readFile('db.conf.json', 'utf8', (err: NodeJS.ErrnoException, data: string) => {
            if (err) return reject(err);
            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(err);
            }
        });
    });
