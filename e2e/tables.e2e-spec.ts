import { browser } from 'protractor';
import { AuthHelper } from './helpers/auth-helper';
import { SidenavHelper } from './helpers/sidenav-helper';
import { TablesPage } from './pages/tables.po';
import ExpectStatic = Chai.ExpectStatic;

const expect: ExpectStatic = global['chai'].expect;

describe('Tables', () => {
    const authHelper = AuthHelper.get();
    const sidenav = new SidenavHelper();
    const page = new TablesPage();

    before(async () => {
        await browser.get('/');
        await authHelper.login({ refreshAfter: true });
    });

    it('should be accessible from the sidenav', async () => {
        await sidenav.browseData('order');
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables\/helium\/order$/);
    });

    it('should populate with data when nagivated to', async () => {
        await page.navigateTo('helium', 'order');

        // 6 normal headers, 1 for the 'insert like' column
        await expect(page.headers().count()).to.eventually.equal(7);

        // We create 8 entries in init.sql
        await expect(page.rows().count()).to.eventually.be.at.least(8);
    });

    it('should allow the user to click a FK icon to navigate to the head of the reference chain', async () => {
        // Make sure it works across different schemas
        await page.navigateTo('helium2', 'cross_schema_ref_test');

        const link = await page.getForeignKeyHeaderHref('fk');

        // In the actual schema:
        // 1. helium2.cross_schema_ref_test.fk ==> helium.order.customer_id
        // 2.         helium.order.customer_id ==> helium.customer.customer_id
        //
        // We expect to see:
        // 1. helium2.cross_schema_ref_test.fk ==> helium.customer.customer_id

        await expect(link).to.match(/\/tables\/helium\/customer$/);
    });

    it('should allow the user to choose a table after navigating to one that doesn\'t exist', async () => {
        // This is mostly to ensure the Observable chain doesn't break when it
        // encounters an error

        await page.navigateTo('helium', 'unknown_table');

        await sidenav.browseData('order');
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables\/helium\/order$/);
    });
});
