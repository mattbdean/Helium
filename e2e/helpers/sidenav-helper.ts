import {
    browser, by, element, ElementFinder,
    ExpectedConditions
} from 'protractor';
import { TableName } from '../../common/table-name.class';

/**
 * Helper class to access data shown in the sidenav
 */
export class SidenavHelper {
    /** An ElementFinder for the sidenav container */
    private get sidenav(): ElementFinder {
        return browser.element(by.css('mat-sidenav'));
    }

    /** Resolves to true if the sidenav is being shown */
    public isVisible() {
        return this.sidenav.isDisplayed();
    }

    /** Resolves to true if the sidenav toggle button is visible */
    public isToggleable() {
        return browser.element(by.css('button.sidenav-toggle')).isDisplayed();
    }

    /** The value of the currently selected schema */
    public selectedSchema() {
        return browser.element(by.css('div.mat-select-value')).getText();
    }

    /** Waits until the sidenav is no longer visible */
    public waitForHide() {
        return browser.wait(ExpectedConditions.invisibilityOf(this.sidenav));
    }

    /** Resolves to a list of all tables being shown */
    public async tables(): Promise<TableName[]> {
        const hrefs = (await element.all(by.css('a.table-name'))
            .map((el) => el.getAttribute('href'))) as string[];

        return hrefs.map((href) => {
            // href is going to be something like
            // http://localhost:3000/tables/<schema>/<table_raw_name>
            const parts = href.split('/');

            const schema = parts[parts.length - 2];
            // Manually fix the '#' prefix that gets URL-encoded
            const rawName = parts[parts.length - 1].replace('%23', '#');

            return { schema, rawName };
        }).map((parsed) => new TableName(parsed.schema, parsed.rawName));
    }

    /** Clicks the first sidenav entry link whose text matches the given string */
    public browseData(cleanName: string) {
        return this.tableNameLink(cleanName).click();
    }

    /** Clicks the first '+' button in the sidenav for the given table's clean name */
    public openForm(cleanName: string) {
        // Find the link that'll open up the table
        return this.tableNameLink(cleanName)
            // Navigate to its parent (both the /tables and /forms link are here)
            .element(by.xpath('..'))
            // Select the forms link
            .element(by.css('a.add-data-icon'))
            .click();
    }

    private tableNameLink(cleanName: string) {
        return element.all(by.css('a.table-name'))
            .filter((el) => el.getText().then((text) => text === cleanName))
            .first();
    }
}
