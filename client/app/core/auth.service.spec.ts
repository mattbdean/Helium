import { HttpHeaders, HttpRequest } from '@angular/common/http';
import {
    HttpClientTestingModule,
    HttpTestingController
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect } from 'chai';
import { AuthData } from './auth-data.interface';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

describe('AuthService', () => {
    let service: AuthService;
    let http: HttpTestingController;
    let storage: StorageService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientTestingModule
            ],
            providers: [
                AuthService,
                { provide: StorageService, useClass: MockStorageService }
            ]
        });

        service = TestBed.get(AuthService);
        http = TestBed.get(HttpTestingController);
        storage = TestBed.get(StorageService);
    });
    
    const fakeAuthData: AuthData = {
        apiKey: 'foo',
        expiration: new Date(Date.now() + 10000)
    };

    const updateAuthData = (data: AuthData | null) => {
        // Use this to access the private method
        (service as any).update(data);
    };

    describe('(constructor)', () => {
        it('should load previously stored data when not expired', () => {
            storage.set(AuthService.KEY_API_KEY, 'foo');
            // Expiration 
            const expiration = Date.now() + 1000;
            storage.set(AuthService.KEY_EXPIRATION, String(expiration));

            // Reuse the previously created services to manually create this
            // service to test the constructor
            const s = new AuthService(http as any, storage);
            expect(s.current).to.deep.equal({ apiKey: 'foo', expiration: new Date(expiration) });
        });

        it('should remove expired stored data', () => {
            storage.set(AuthService.KEY_API_KEY, 'foo');
            // 0ms = Jan 1, 1970, definitely expired
            storage.set(AuthService.KEY_EXPIRATION, '0');

            const s = new AuthService(http as any, storage);
            expect(s.current).to.equal(null);
        });
    });

    describe('loggedIn', () => {
        it('should be true when there\'s AuthData present', () => {
            updateAuthData(null);
            service.loggedIn.should.be.false;
        });

        it('should be false when there\'s no AuthData present', () => {
            updateAuthData(fakeAuthData);
            service.loggedIn.should.be.true;
        });
    });

    describe('login', () => {
        it('should send the login request and update the stored data and observable', () => {
            const reqBody = { username: 'username', password: 'password', host: 'host' };

            service.login(reqBody)
                .subscribe((result: AuthData) => {
                    expect(result).to.deep.equal(fakeAuthData);
                });
            
            const res = http.expectOne((req: HttpRequest<any>): boolean => {
                return req.method === 'POST' &&
                    req.url === '/api/v1/login' &&
                    req.body === reqBody;
            });

            res.flush({ apiKey: fakeAuthData.apiKey }, {
                headers: new HttpHeaders({
                    'X-Session-Expiration': String(fakeAuthData.expiration.getTime())
                })
            });
        });
    });

    describe('logout', () => {
        it('should update the storage and observable with null data', () => {
            updateAuthData(fakeAuthData);
            service.logout();
            expect(service.current).to.be.null;
        });
    });

    afterEach(() => {
        // Make sure all requests were completed as expected
        http.verify();
    });
});

export class MockStorageService {
    private data: { [key: string]: string } = {};

    public get(key: string) { return this.data[key]; }
    public has(key: string) { return this.data[key] !== undefined; }
    public set(key: string, value: string) { this.data[key] = value; }
    public clear() { this.data = {}; }
    public delete(key: string) { delete this.data[key]; }
}
