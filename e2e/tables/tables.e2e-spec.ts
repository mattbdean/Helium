import { browser } from 'protractor';
import { TablesPage } from './tables.po';

const expect = global['chai'].expect;

describe('Tables page', () => {
    let page: TablesPage;

    beforeEach(() => {
        page = new TablesPage();
    });

    it('should show the name of the table as the page header', async () => {
        // tableName is the "clean" name, not necessarily the name that's used
        // in SQL and the /tables link. For example, the sidebar might list a
        // table with a name of 'person', but the actual SQL table is called
        // '#person'. Clicking on that link wouldn't redirect to
        // '/tables/person', but rather to '/tables/%23person'
        const tableName = (await page.getTableNames())[0];
        await page.clickSidebarLink(tableName, 'table');
        await expect(browser.getCurrentUrl()).to.eventually.include.all('/tables', tableName);
        await expect(page.getHeaderText()).to.eventually.equal(tableName);
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
        const tableNames = await page.getTableNames();
        const tableName = tableNames[0];
        await page.navigateTo('foobar');
        await page.clickSidebarLink(tableName, 'table');
        await expect(browser.driver.getCurrentUrl()).to.eventually.include.all('/tables/', tableName);
        await expect(page.getHeaderText()).to.eventually.equal(tableName);
    });
});
