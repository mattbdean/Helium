import { browser } from 'protractor';

before(() => {
    // Disable waiting for Angular since long-running tasks on NgZone will cause
    // Protractor to poop out on us
    browser.waitForAngularEnabled(false);
});
