import { browser } from 'protractor';
import * as request from 'superagent';
import { AuthData } from '../../client/app/core/auth-data/auth-data.interface';
import { StorageHelper } from './storage-helper';

/**
 * This class helps authenticate the testing browser. This is done by accessing
 * the JSON API directly instead of interacting with the DOM.
 */
export class AuthHelper {
    public static readonly USERNAME = 'user';
    public static readonly PASSWORD = 'password';

    private static readonly INSTANCE = new AuthHelper();

    /** Lazily initialized auth data */
    private authData: AuthData | null = null;
    private storage = new StorageHelper();

    // Singleton
    private constructor() {}

    /**
     * Requests an API key if necessary and then authenticates the testing
     * browser by modifying the localStorage. A refresh is mandatory in order
     * for the app to pick up the new data.
     */
    public async login(opts?: { refreshAfter?: boolean }) {
        if (this.authData === null)
            this.authData = await AuthHelper.freshLogin();

        await this.storage.clear();
        await this.storage.setAll({
            apiKey: this.authData.apiKey,
            expiration: this.authData.expiration.getTime().toString(),
            username: this.authData.username,
            host: this.authData.host
        });

        if (opts && opts.refreshAfter) {
            await browser.refresh(3000);
        }
    }

    public static get() { return AuthHelper.INSTANCE; }

    /** Uses the JSON API to request an API key */
    private static async freshLogin(): Promise<AuthData> {
        const res = await request
            .post(browser.baseUrl + 'api/v1/login')
            .send({ username: AuthHelper.USERNAME, password: AuthHelper.PASSWORD });

        const apiKey = res.body.apiKey;
        const expiration = parseInt(res.header['x-session-expiration'], 10);

        return {
            apiKey,
            expiration: new Date(expiration),
            username: AuthHelper.USERNAME,
            host: ''
        };
    }
}
