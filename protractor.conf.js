// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

exports.config = {
    allScriptsTimeout: 11000,
    specs: [
        './e2e/**/*.e2e-spec.ts'
    ],
    capabilities: {
        'browserName': 'chrome'
    },
    directConnect: true,
    baseUrl: 'http://localhost:4200/',
    framework: 'jasmine',
    mochaOpts: {
        reporter: 'spec',
        slow: 3000,
        ui: 'bdd',
        timeout: 30000
    },
    beforeLaunch: () => {
        require('ts-node').register({
            project: 'e2e/tsconfig.e2e.json'
        });
    },
    onPrepare: () => {
        const chai = require('chai');
        const chaiAsPromised = require('chai-as-promised');
        chai.use(chaiAsPromised);
        global.chai = chai;
    }
};
