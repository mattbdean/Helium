import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { AuthData } from './auth-data.interface';
import { StorageService } from './storage.service';

/**
 * A service that manages the current API key and its expiration.
 */
@Injectable()
export class AuthService {
    public static readonly KEY_API_KEY = 'apiKey';
    public static readonly KEY_EXPIRATION = 'expiration';

    private authData$: BehaviorSubject<AuthData | null> = new BehaviorSubject(null);

    public constructor(private http: HttpClient, private storage: StorageService) {
        // Load previously stored data
        if (this.storage.has(AuthService.KEY_API_KEY) && this.storage.has(AuthService.KEY_EXPIRATION)) {
            // Parse the expiration key abUTHe 10 int
            const expiration = parseInt(this.storage.get(AuthService.KEY_EXPIRATION), 10);

            // Create a null AuthData if the stored data is already expired,
            // otherwise pull data from the storage provider
            const data: AuthData = expiration < Date.now() ? null : {
                apiKey: this.storage.get(AuthService.KEY_API_KEY),
                expiration: new Date(parseInt(this.storage.get(AuthService.KEY_EXPIRATION), 10))
            };

            // Update the BehaviorSubject. If data is null, will also remove the
            // stored data from the storage provider
            this.update(data);
        }
    }

    /** Returns true if there is an unexpired API key on file */
    public get loggedIn(): boolean {
        const data = this.authData$.getValue();

        // No stored key
        if (data === null)
            return false;

        // There is a stored key, but its expired
        if (data.expiration.getTime() < Date.now()) {
            this.update(null);
            return false;
        }

        // There's an unexpired key
        return true;
    }

    public get current(): AuthData | null { return this.authData$.getValue(); }

    /** The current API key, or null if there is none */
    public get apiKey(): string | null {
        const data = this.authData$.getValue();
        return data === null ? null : data.apiKey;
    }

    /** The expiraton date of the API key, or null if there is none */
    public get expiration(): Date {
        const data = this.authData$.getValue();
        return data === null ? null : data.expiration;
    }

    /** Attempts to log in usign the given connection configuration */
    public login(data: { username: string, password: string, host: string }) {
        // Specify observe: 'response' to get the full response, not just the
        // body
        return this.http.post('/api/v1/login', data, { observe: 'response' })
            .map((res: HttpResponse<{ apiKey: string }>): AuthData => {
                // This is the unix epoch time at which the session expires
                const expiration = res.headers.get('X-Session-Expiration');

                return {
                    apiKey: res.body.apiKey,
                    expiration: new Date(parseInt(expiration, 10))
                };
            })
            .do((parsed) => this.update(parsed));
    }

    /** Removes all stored authentication data */
    public logout() {
        this.update(null);
    }

    /**
     * Returns an observable that listens to changes in the API key and its
     * expiration.
     */
    public changes(): Observable<AuthData> {
        return this.authData$;
    }

    /** Updates the storage service and the BehaviorSubject */
    public update(data: AuthData) {
        if (data === null) {
            // Might have to change this if we start storing other data
            this.storage.clear();
        } else {
            this.storage.set(AuthService.KEY_API_KEY, data.apiKey);
            this.storage.set(AuthService.KEY_EXPIRATION, String(data.expiration));
        }

        this.authData$.next(data);
    }
}
