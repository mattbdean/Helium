import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

describe('AuthGuardService', () => {
    let router: Router;

    beforeEach(() => {
        const mockRouter = { navigate: () => undefined };
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue:  mockRouter }
            ]
        });
        
        router = TestBed.get(Router);
    });

    it('should reroute when not logged in');
    it('should remove expired data and then reroute');
    it('should return true when logged in with unexpired data');
});
