import { browser } from 'protractor';
import { TablesPage } from './tables.po';

const expect = global['chai'].expect;

describe('Tables page', () => {
    let page: TablesPage;

    beforeEach(() => {
        page = new TablesPage();
    });

    it('should show the name of the table as the page header', async () => {
        const table = 'customer';
        await page.clickSidebarLink(table, 'table');
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables\/customer$/);
        await expect(page.getHeaderText()).to.eventually.equal(table);
        await expect(page.isDatatableVisible()).to.eventually.be.true;
    });

    it('should show an error message when requesting a table that doesn\'t exist', async () => {
        await page.navigateTo('foobar');
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables\/foobar$/);
        await expect(page.getHeaderText()).to.eventually.equal('Table not found');
        await expect(page.isDatatableVisible()).to.eventually.be.false;
    });

    // Make sure our Observable pipeline isn't breaking down once it encounters an error
    it('should allow the user to click on another sidebar link if the current table doesn\'t exist', async () => {
        await page.navigateTo('foobar');
        await page.clickSidebarLink('customer', 'table');
        await expect(browser.driver.getCurrentUrl()).to.eventually.match(/\/tables\/customer$/);
        await expect(page.getHeaderText()).to.eventually.equal('customer');
    });
});
