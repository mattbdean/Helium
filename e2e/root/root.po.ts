import { browser, by, element } from 'protractor';
import { promise as wdpromise } from 'selenium-webdriver';
import { SidebarPage } from "../util";

/**
 * The root page is what the user sees when they open up the base URL.
 */
export class RootPage extends SidebarPage {
    public navigateTo(): wdpromise.Promise<void> {
        return browser.get('/');
    }

    public getToolbarText(): wdpromise.Promise<string> {
        return element(by.css('.mat-toolbar-row')).getText();
    }
}
