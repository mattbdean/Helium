// Karma configuration file, see link for more information
// https://karma-runner.github.io/0.13/config/configuration-file.html

const path = require('path');

module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['mocha', 'sinon-chai', '@angular-devkit/build-angular'],
        plugins: [
            require('karma-mocha'),
            require('karma-sinon-chai'),

            require('karma-mocha-clean-reporter'),
            require('karma-chrome-launcher'),
            require('karma-coverage-istanbul-reporter'),

            require('@angular-devkit/build-angular/plugins/karma')
        ],
        browserDisconnectTimeout: 30000,
        browserNoActivityTimeout: 30000,
        client: {
            clearContext: false
        },
        files: [
            { pattern: '../node_modules/@angular/material/prebuilt-themes/deeppurple-amber.css', instrument: false },
        ],
        coverageIstanbulReporter: {
            reports: ['html', 'lcovonly'],
            dir: path.join(__dirname, 'coverage/client'),
            fixWebpackSourcePaths: true
        },
        reporters: ['mocha-clean'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: ['Chrome'],
        singleRun: false
    });
};
