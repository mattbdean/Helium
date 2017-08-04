import { browser } from "protractor";
import { RootPage } from './root.po';

const expect = global['chai'].expect;

describe('Root page', () => {
    let page: RootPage;

    beforeEach(() => {
        page = new RootPage();
    });

    it('should display welcome message', () => {
        page.navigateTo();
        expect(page.getToolbarText()).to.eventually.equal('Helium');

    });

    it('should redirect to /tables on load', () => {
        page.navigateTo();
        expect(browser.driver.getCurrentUrl()).to.eventually.match(/\/tables$/);
    });

    it('should display a list of available tables in the sidebar', async () => {
        const count = await page.getTableCount();
        expect(count).to.be.above(0);

        for (let i = 0; i < count; i++) {
            const links = page.getTableLinks(i);
            // One link to view the table, one to go to its form
            expect(links.count()).to.eventually.equal(2);

            const tableLink = links.first();
            const tableName = await tableLink.getText();
            expect(tableLink.getAttribute('href')).to.eventually.match(new RegExp('/tables/' + tableName + '$'));

            const formLink = links.get(1);
            expect(formLink.getAttribute('href')).to.eventually.match(new RegExp('/forms/' + tableName + '$'));
        }
    });
});
