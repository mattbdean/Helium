import { AppPage } from './app.po';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { browser } from 'protractor';

chai.use(chaiAsPromised);

const expect = chai.expect;

describe('app', () => {
    let page: AppPage;

    beforeEach(() => {
        page = new AppPage();
    });

    it('should let us know that the app works', () => {
        page.navigateTo();
        expect(browser.getCurrentUrl()).to.eventually.match(/home$/);
        expect(page.getHeader()).to.eventually.equal('It works!');
    });
});
