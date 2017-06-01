import { Database, Mode } from '../src/Database';

// Mocha root suite. Install test hooks for all tests here.
// https://mochajs.org/#root-level-hooks

before('connect to database', () => {
    return Database.get().connect(Mode.TEST);
});

after('disconnect from database', () => {
    return Database.get().disconnect();
});
