import { Database, Mode } from '../src/Database';

// Catch unhandled Promises
process.on('unhandledRejection', (reason) => {
    process.stderr.write("Unhandled Promise rejection:\n");
    console.error(reason);
    process.exit(1);
});

// Mocha root suite. Install test hooks for all tests here.
// https://mochajs.org/#root-level-hooks

before('connect to database', () => {
    return Database.get().connect(Mode.TEST);
});

after('disconnect from database', () => {
    return Database.get().disconnect();
});
