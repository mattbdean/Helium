/**
 * Helper class for working with global `Storage` instances (`localStorage`,
 * `sessionStorage`, etc). Note that since this class relies heavily on
 * WebDriverJS' executeScript() function (which is a glorified eval call),
 * these methods shouldn't be used anywhere besides a trusted environment.
 */
import { browser } from 'protractor';

export class StorageHelper {
    public constructor(public storageName: 'localStorage' | 'sessionStorage' = 'localStorage') {}

    public clear() {
        return browser.executeScript(this.createCall('clear()'));
    }

    public set(key: string, value: string) {
        return browser.executeScript(this.createCall(`setItem('${key}', '${value}')`));
    }

    public async setAll(data: { [key: string]: string }) {
        for (const key of Object.keys(data)) {
            await this.set(key, data[key]);
        }
    }

    private createCall(storageAction: string) {
        return `window.${this.storageName}.${storageAction}`;
    }
}
