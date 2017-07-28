import { browser, by, element } from 'protractor';

export class HomePage {
    public navigateTo() {
        return browser.get('/');
    }

    public getToolbarText() {
        return element(by.css('.mat-toolbar-row')).getText();
    }
}
