import { Router } from '@angular/router';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { AuthGuard } from './auth-guard.service';
import { AuthService } from './auth.service';

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
            update: () => { /* do nothing */ }
        } as any as any;

        guard = new AuthGuard(auth, router);
    });

    describe('canActivate', () => {
        it('should reroute when not logged in', () => {
            sinon.stub(auth, 'loggedIn').get(() => false);
            const spy = sinon.spy(router, 'navigate');

            expect(guard.canActivate(null, null)).to.be.false;

            expect(spy).to.have.been.calledWithExactly(['/login']);
        });

        it('should remove expired data and then reroute', () => {
            // Already logged in with an expiration in the past
            sinon.stub(auth, 'loggedIn').get(() => true);
            sinon.stub(auth, 'expiration').get(() => new Date(Date.now() - 1000));

            const updateSpy = sinon.spy(auth, 'update');
            const navigateSpy = sinon.spy(router, 'navigate');

            expect(guard.canActivate(null, null)).to.be.false;

            // Should have called update(null) to remove the expired data
            expect(updateSpy).to.have.been.calledWithExactly(null);

            // Should redirect as well
            expect(navigateSpy).to.have.been.calledWithExactly(['/login']);
        });

        it('should return true when logged in with unexpired data', () => {
            // Already logged in with an expiration in the future
            sinon.stub(auth, 'loggedIn').get(() => true);
            sinon.stub(auth, 'expiration').get(() => new Date(Date.now() + 1000));

            expect(guard.canActivate(null, null)).to.be.true;
        });
    });
});
