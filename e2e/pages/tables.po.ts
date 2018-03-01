import { browser, by, element } from 'protractor';

export class TablesPage {
    public navigateTo(schema: string, table: string) {
        return browser.get(`/tables/${schema}/${table}`);
    }

    public headers() {
        return element.all(by.css('mat-header-cell'));
    }

    public rows() {
        return element.all(by.css('mat-row'));
    }

    public getForeignKeyHeaderHref(headerName: string) {
        return element.all(by.css('span.header-container'))
            .filter((el) => el.getText().then((text) => text.trim() === headerName))
            .first()
            .element(by.css('a.header-icon[data-constraint-type=foreign]'))
            .getAttribute('href');
    }

    /** Presses the 'insert like' button on a particular row. */
    public insertLike(rowNum: number) {
        return element.all(by.css(`datatable-body-cell[ng-reflect-row-index='${rowNum}']`))
            .first()
            .element(by.css('mat-icon.insert-like-icon'))
            .click();
    }
}
