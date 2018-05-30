import { browser } from 'protractor';
import { ISize } from 'selenium-webdriver';
import { AuthHelper } from './helpers/auth-helper';
import { FormHelper } from './helpers/form-helper';
import { SidenavHelper } from './helpers/sidenav-helper';
import { SnackbarHelper } from './helpers/snackbar-helper';
import ExpectStatic = Chai.ExpectStatic;
import { StorageHelper } from './helpers/storage-helper';
import { AuthPage } from './pages/auth.po';

const expect: ExpectStatic = global['chai'].expect;

describe('Authentication', () => {
    const localStorage = new StorageHelper();
    const authHelper = AuthHelper.get();
    const sidenav = new SidenavHelper();
    const form = new FormHelper();
    const snackbarHelper = new SnackbarHelper();

    const page = new AuthPage();

    describe('Before logging in', () => {
        beforeEach(async () => {
            await page.navigateTo();

            // Make sure any login attempts to influence later tests
            localStorage.clear();
        });

        it('should redirect to /login when not logged in', async () => {
            const paths = ['/', '/tables', '/forms'];
            for (const path of paths) {
                await browser.get(path);
                await expect(browser.getCurrentUrl()).to.eventually.match(/\/login$/);
            }
        });

        it('should allow us to login using our MySQL credentials and then logout', async () => {
            // Shouldn't be able to see the sidenav when logged out, no matter the
            // size of the screen
            await expect(sidenav.isVisible()).to.eventually.be.false;
            await expect(sidenav.isToggleable()).to.eventually.be.false;

            const submitButton = form.submitButton;

            // Submit should be disabled by default, and when the form is invalid
            expect(submitButton.isEnabled()).to.eventually.be.false;

            // Fill out the form with the MySQL credentials
            await page.fillForm(AuthHelper.USERNAME, AuthHelper.PASSWORD);

            // Now that the form is valid, the submit button should be enabled
            expect(submitButton.isEnabled()).to.eventually.be.true;

            // Login
            await form.submit();

            // We should be redirected to /tables
            await expect(browser.getCurrentUrl()).to.eventually.match(/\/tables$/);

            // We should be able to see the sidenav now
            await expect(sidenav.isVisible()).to.eventually.be.true;

            // Browser window should be big enough to be always showing the
            // sidenav (see protractor.conf.js)
            await expect(sidenav.isToggleable()).to.eventually.be.false;

            // Click the logout button
            await page.logout();

            // Should be redirected back to the login page
            await expect(browser.getCurrentUrl()).to.eventually.match(/\/login$/);
        });

        it('should use a snackbar to show when the user has invalid credentials', async () => {
            // Fill the form with credentials that don't work.
            await page.fillForm('bad_username', 'bad_password');
            await form.submit();

            const snackbar = await snackbarHelper.waitFor();
            await expect(snackbar.message).to.equal('Invalid login information');
        });
    });

    describe('After logging in', () => {
        let prevSize: ISize;

        before(async () => {
            await browser.get('/');
            // Use this to preserve the original window size
            prevSize = await browser.driver.manage().window().getSize();
        });

        beforeEach(async () => {
            // Use authHelper so we don't have to mess with the DOM again
            await authHelper.login({ refreshAfter: true });
        });

        afterEach(async () => {
            // Restore the original window dimensions
            await browser.driver.manage().window().setSize(prevSize.width, prevSize.height);
        });

        it('should automatically load the available schemas and choose one', async () => {
            // Should pick the first one alphabetically (unless that happens to
            // be information_schema)
            await expect(sidenav.selectedSchema()).to.eventually.equal('helium_compound_fk_test');

            // There should be at least a few tables
            await expect(sidenav.tables()).to.eventually.have.length.above(0);
        });

        it('should hide the sidenav when the browser window is small', async () => {
            // The browser starts off big enough to always be visible
            await expect(sidenav.isVisible()).to.eventually.be.true;
            await expect(sidenav.isToggleable()).to.eventually.be.false;

            await browser.driver.manage().window().setSize(500, 500);

            // Wait for the transition to finish
            await browser.wait(sidenav.waitForHide());

            // Browser width is less than that specified in AppComponent, should
            // hide the sidenav by default and have it be toggleable
            await expect(sidenav.isVisible()).to.eventually.be.false;
            await expect(sidenav.isToggleable()).to.eventually.be.true;
        });

        it('should select the schema of the table being viewed, if there is one', async () => {
            const defaultSchema = 'helium_compound_fk_test';
            const expectations: Array<[string, string]> = [
                [ '/', defaultSchema ], // Default schema is chosen alphabetically
                [ '/tables/helium_sample', 'helium_sample' ],
                [ '/tables/helium_sample/customer', 'helium_sample' ],
                [ '/tables/unknown_schema', defaultSchema ], // Should fall back to default
                [ '/forms/helium_sample', 'helium_sample' ]
            ];

            for (const [url, schema] of expectations) {
                await browser.get(url);
                await expect(sidenav.selectedSchema()).to.eventually.equal(schema);
            }
        });
    });
});
