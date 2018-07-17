import {
    ActivatedRouteSnapshot, Router,
    RouterStateSnapshot
} from '@angular/router';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { LoginComponent } from '../../login/login.component';
import { AuthService } from '../auth/auth.service';
import { AuthGuard } from './auth-guard.service';

chai.use(sinonChai);

const expect = chai.expect;

describe('AuthGuardService', () => {
    let router: Router;
    let auth: AuthService;

    let guard: AuthGuard;

    beforeEach(() => {
        router = {
            navigate: () => { /* do nothing */ }
        } as any as Router;

        auth = {
            get loggedIn() { throw new Error('loggedIn not stubbed'); },
            get expiration() { throw new Error('expiration not stubbed'); },
            get lastValidAuthData() { throw new Error('lastValidAuthData not stubbed'); },
            update: () => { /* do nothing */ }
        } as any as any;

        guard = new AuthGuard(auth, router);
    });

    const activatedRouteSnapshot = {} as ActivatedRouteSnapshot;
    const routerStateSnapshot = {
        url: '/foo/bar'
    } as RouterStateSnapshot;

    const canActivate = () => guard.canActivate(activatedRouteSnapshot, routerStateSnapshot);

    describe('canActivate', () => {
        it('should reroute when not logged in', () => {
            sinon.stub(auth, 'loggedIn').get(() => false);
            sinon.stub(auth, 'expiration').get(() => null);
            sinon.stub(auth, 'lastValidAuthData').get(() => ({
                apiKey: 'apiKey',
                expiration: new Date(),
                username: 'username',
                host: 'host'
            }));
            const spy = sinon.spy(router, 'navigate');

            expect(canActivate()).to.be.false;

            expect(spy).to.have.been.calledWithExactly(['/login'], {
                queryParams: LoginComponent.createRedirectQuery({
                    username: 'username',
                    host: 'host',
                    path: '/foo/bar'
                })
            });
        });

        it('should remove expired data and then reroute', () => {
            // Already logged in with an expiration in the past
            sinon.stub(auth, 'loggedIn').get(() => true);
            sinon.stub(auth, 'expiration').get(() => new Date(Date.now() - 1000));
            sinon.stub(auth, 'lastValidAuthData').get(() => null);

            const updateSpy = sinon.spy(auth, 'update');
            const navigateSpy = sinon.spy(router, 'navigate');

            expect(canActivate()).to.be.false;

            // Should have called update(null) to remove the expired data
            expect(updateSpy).to.have.been.calledWithExactly(null);

            // Should redirect as well
            expect(navigateSpy).to.have.been.calledWithExactly(['/login'], { queryParams: {} });
        });

        it('should return true when logged in with unexpired data', () => {
            // Already logged in with an expiration in the future
            sinon.stub(auth, 'loggedIn').get(() => true);
            sinon.stub(auth, 'expiration').get(() => new Date(Date.now() + 1000));

            expect(canActivate()).to.be.true;
        });
    });
});
