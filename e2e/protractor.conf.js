// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

exports.config = {
    allScriptsTimeout: 11000,
    specs: [
        './**/*.e2e-spec.ts'
    ],
    capabilities: {
        browserName: 'chrome',
        chromeOptions: {
            // Anything with a width over AppComponent.ALWAYS_SHOW_SIDENAV_WIDTH will work
            args: ['--window-size=1500,800']
        }
    },
    directConnect: true,
    baseUrl: 'http://localhost:3000/',
    framework: 'mocha',
    mochaOpts: {
        reporter: 'spec',
        slow: 3000,
        ui: 'bdd',
        timeout: 30000
    },
    SELENIUM_PROMISE_MANAGER: false,
    beforeLaunch: () => {
        require('ts-node').register({
            project: 'e2e/tsconfig.e2e.json'
        });
        process.on('unhandledRejection', (reason) => {
            process.stderr.write("Unhandled Promise rejection:\n");
            throw reason;
        });
    },
    onPrepare: () => {
        const chai = require('chai');
        const chaiAsPromised = require('chai-as-promised');
        chai.use(chaiAsPromised);
        global.chai = chai;
    }
};
