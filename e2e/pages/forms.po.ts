import { browser, by, element } from 'protractor';

export class FormsPage {
    public navigateTo(schema: string, table: string) {
        return browser.get(`/forms/${schema}/${table}`);
    }

    public partialForms() {
        return element.all(by.css('partial-form'));
    }

    /**
     * Returns all entry containers. An entry container holds all the inputs
     * for exactly one entry into a form. A master table always has exactly one
     * entry container, while a part table can have 0 or more.
     */
    public entryContainers() {
        return element.all(by.css('.entry-container'));
    }

    /**
     * Clicks the '+' button at the specified part table
     */
    public addPartTableEntry(partTableIndex: number) {
        return this.partialForms()
            .get(partTableIndex + 1)
            .all(by.css('.add-button-wrapper'))
            .last()
            .element(by.css('button'))
            .click();
    }

    /**
     * Clicks the '-' button of the last entry at the specified part table
     */
    public removePartTableEntry(partTableIndex: number) {
        return this.partialForms()
            .get(partTableIndex + 1)
            .all(by.css('.remove-button-wrapper'))
            .last()
            .element(by.css('button'))
            .click();
    }
}
