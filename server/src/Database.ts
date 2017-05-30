import * as fs from 'fs';
import * as path from 'path';

import * as chalk from 'chalk';
import * as Joi from 'joi';
import * as Sequelize from 'sequelize';

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
    private internalMode: Mode;

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

        // Wrap Sequelize Bluebird Promise into a global.Promise
        return new Promise<void>((resolve, reject) => {
            this.sequelize.authenticate().then(resolve).catch(reject);
        });
    }

    public disconnect() {
        this.internalSql.close();
    }

    public get sequelize() { return this.internalSql; }
    public get mode() { return this.internalMode; }

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
            // https://docs.travis-ci.com/user/database-setup/#MySQL
            return { username: 'root', password: '', database: 'test' };

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

// const User = Sequelize.define('user', {
//     firstName: { type: Sequelize.STRING },
//     lastName: { type: Sequelize.STRING }
// });

// const main = async () => {
//     const db = Database.get();
//     try {
//
//         await sequelize.authenticate();
//         await User.sync({ force: true });
//         await User.create({
//             firstName: 'John',
//             lastName: 'Hancock'
//         });
//
//         console.log(await User.findAll())
//     } catch (err) {
//         console.error('Error: ' + err);
//     } finally {
//         sequelize.close();
//     }
// };
//
// main().catch(console.error);
