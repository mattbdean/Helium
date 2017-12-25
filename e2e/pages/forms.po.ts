import { browser, by, element } from 'protractor';

export class FormsPage {
    public navigateTo(schema: string, table: string) {
        return browser.get(`/forms/${schema}/${table}`);
    }

    public partialForms() {
        return element.all(by.css('partial-form'));
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
