import { Database, DbConf, Mode } from '../src/Database';

// Catch unhandled Promises
process.on('unhandledRejection', (reason) => {
    process.stderr.write("Unhandled Promise rejection:\n");
    console.error(reason);
    process.exit(1);
});

// Mocha root suite. Install test hooks for all tests here.
// https://mochajs.org/#root-level-hooks

before('connect to database', () => {
    let conf: Mode | DbConf = Mode.TEST;
    if (process.env.TEST_DATABASE) {
        conf = createEnvConfig();
    }
    return Database.get().connect(conf);
});

after('disconnect from database', () => {
    return Database.get().disconnect();
});

const createEnvConfig = (): DbConf => {
    const keys = ["host", "user", "password", "database"];
    const conf: DbConf = {};
    for (const key of keys) {
        conf[key] = process.env[`TEST_${key.toUpperCase()}`];
    }
    return conf;
};
