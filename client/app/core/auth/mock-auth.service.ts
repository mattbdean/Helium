import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { of } from 'rxjs';
import { delay, distinctUntilChanged, map, tap } from 'rxjs/operators';
import { AuthData } from '../auth-data/auth-data.interface';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';

@Injectable()
export class MockAuthService extends AuthService {
    public constructor(http: HttpClient, storage: StorageService) {
        super(http, storage);
    }

    public login(data) {
        const mockData: AuthData = {
            apiKey: 'mock API key',
            // expires 1 year in advance
            expiration: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)),
            username: data.username,
            host: data.host
        };

        return of(mockData).pipe(
            delay(10 + Math.random() * 10),
            tap((authData) => this.update(authData))
        );
    }
}
