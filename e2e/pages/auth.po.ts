import { isNil, pickBy } from 'lodash';
import { browser, by } from 'protractor';
import { FormHelper } from '../helpers/form-helper';

/**
 * Page Object for the login screen (/login).
 */
export class AuthPage {
    private form = new FormHelper();

    /** Fetches the login page */
    public navigateTo() {
        return browser.get('/login');
    }

    /** Fills out the login form with the specified values */
    public async fillForm(username?: string, password?: string, host?: string) {
        return this.form.fill(pickBy({
            username,
            password,
            host
        }, (val) => !isNil(val)) as { [formControlName: string]: string });
    }

    /** Clicks the 'Logout' button */
    public logout() {
        return browser.findElement(by.css('button.logout-button')).click();
    }
}
