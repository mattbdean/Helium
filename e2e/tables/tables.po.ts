import { browser, by, element, ElementFinder } from 'protractor';
import { promise as wdpromise } from 'selenium-webdriver';
import { SidebarPage } from '../util';

export class TablesPage extends SidebarPage {
    public navigateTo(tableName: string): wdpromise.Promise<void> {
        return browser.get('/tables/' + tableName);
    }

    public getHeaderText(): wdpromise.Promise<string> {
        // Find the text of the first visible <h1>
        return element.all(by.css('h1'))
            .filter((el: ElementFinder) => el.isDisplayed())
            .first()
            .getText();
    }

    public isDatatableVisible(): wdpromise.Promise<boolean> {
        return element(by.css('ngx-datatable')).isDisplayed();
    }
}
