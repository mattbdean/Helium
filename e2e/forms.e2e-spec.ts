import { random, range } from 'lodash';
import * as moment from 'moment';
import { browser, protractor } from 'protractor';
import ExpectStatic = Chai.ExpectStatic;
import { AuthHelper } from './helpers/auth-helper';
import { FormHelper } from './helpers/form-helper';
import { SidenavHelper } from './helpers/sidenav-helper';
import { SnackbarHelper } from './helpers/snackbar-helper';
import { FormsPage } from './pages/forms.po';
import { TablesPage } from './pages/tables.po';

const expect: ExpectStatic = global['chai'].expect;

describe('Forms', () => {
    const sidenav = new SidenavHelper();
    const snackbarHelper = new SnackbarHelper();
    const form = new FormHelper();
    const tablePage = new TablesPage();
    const page = new FormsPage();

    // Produce a random integer with a large upper bound
    const randInt = () => random(100000000);

    before(async () => {
        await browser.get('/');
        await AuthHelper.get().login({ refreshAfter: true });
    });

    it('should allow us to open a form via the sidenav', async () => {
        await browser.get('/tables/helium/customer');
        await sidenav.openForm('Customer');
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/forms\/helium\/customer$/);
    });

    // This test is incredibly shaky
    it.skip('should open a snackbar after successful submit', async () => {
        await page.navigateTo('helium', 'customer');

        // Submit button should be disabled when we first load the data
        await expect(form.submitButton.isEnabled()).to.eventually.be.false;

        // Fill out the form with pseudo-random (but valid) data
        await form.fill({
            customer_id: randInt(),
            name: 'e2e_' + Math.random().toString(36).substring(7)
        });

        // The submit button should be enabled
        await expect(form.submitButton.isEnabled()).to.eventually.be.true;

        // Submit the form
        await form.submitButton.click();

        // Wait for the success snackbar
        const snackbar = await snackbarHelper.waitFor();
        expect(snackbar.message).to.not.be.empty;
        expect(snackbar.action).to.not.be.null;
        expect(snackbar.action!!.text).to.equal('VIEW');

        // Click the 'view' button
        await snackbar.action!!.button.click();

        // We should be redirected to the data
        await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables\/helium\/customer$/);
    });

    it('should open a prefilled form when the "insert like" button in the datatable is pressed', async () => {
        await tablePage.navigateTo('helium', 'customer');
        await tablePage.insertLike(0);

        await expect(browser.getCurrentUrl()).to.eventually.contain('/forms/helium/customer');

        const formData = await form.pluck('customer_id', 'name');

        // First entry created by init.sql
        expect(formData).to.deep.equal({ customer_id: '0', name: 'Some Guy' });
    });

    it.skip('should allow inserting multiple part table entries with the master table', async () => {
        await page.navigateTo('helium', 'master');

        // This table has 2 part tables
        await expect(page.partialForms().count()).to.eventually.equal(3);

        // Add 3 entries to the first part table (master__part)
        await protractor.promise.all(range(3).map(() => page.addPartTableEntry(0)));
        // Add 2 entries to the second part table (master__part2)
        await protractor.promise.all(range(2).map(() => page.addPartTableEntry(1)));

        await form.fill({
            pk: randInt(),
            part_pk: range(3).map(randInt),
            part2_pk: range(2).map(randInt)
        });

        await form.submit();

        const snackbar = await snackbarHelper.waitFor();
        expect(snackbar.action).to.not.be.null;
        expect(snackbar.action!!.text).to.equal('VIEW');
    });

    it('should prepopulate the form with default values', async () => {
        await page.navigateTo('helium', 'defaults_test');
        const data = await form.pluck(
            'pk', 'int', 'float', 'date', 'datetime', 'datetime_now', 'boolean',
            'enum', 'no_default'
        );

        // See helium.defaults_test definition in init.sql
        expect(data).to.deep.equal({
            pk: '',
            int: '5',
            float: '10',
            date: '2017-01-01',
            datetime: '2017-01-01 12:00',
            datetime_now: moment().format('YYYY-MM-DD HH:mm'),
            boolean: true,
            enum: 'a',
            no_default: ''
        });
    });
});
