import { Database, Mode } from '../src/Database';

// Mocha root suite. Install test hooks for all tests here.
// https://mochajs.org/#root-level-hooks

before('connect to database', async () => {
    await Database.get().connect(Mode.TEST);
    await Database.get().init({ force: true });
});

after('disconnect from database', () => {
    Database.get().disconnect();
});
