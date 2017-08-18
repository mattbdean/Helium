import { promise as wdpromise } from 'selenium-webdriver';

import { by, element, ElementArrayFinder, ElementFinder } from "protractor";

export abstract class SidebarPage {
    public masterTablesList = element.all(by.css('.table-ref-master'));

    public getTableCount(): wdpromise.Promise<number> {
        return this.masterTablesList.count();
    }

    public getTableNames(): wdpromise.Promise<string[]> {
        return this.masterTablesList.map((el: ElementFinder) => {
            return el.all(by.css('a')).first().getText();
        });
    }

    public getTableLinks(index: number = 0): ElementArrayFinder {
        const listElement = this.masterTablesList.get(index);
        return listElement.all(by.css('a'));
    }

    public async clickSidebarLink(tableName: string, what: 'table' | 'form'): Promise<void> {
        const links = this.masterTablesList.filter((el: ElementFinder): wdpromise.Promise<boolean> => {
            return el.all(by.css('a')).get(what === 'table' ? 0 : 1).getText().then((text: string) => {
                return text === tableName;
            });
        });

        if (await links.count() === 0) {
            throw new Error(`expected to find a sidebar element with the table name of ${tableName}`);
        }

        return links.first().click();
    }
}
