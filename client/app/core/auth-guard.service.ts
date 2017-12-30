import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    Router,
    RouterStateSnapshot
} from '@angular/router';
import { Observable } from 'rxjs/Observable';
import { AuthService } from './auth.service';

/**
 * When used as a route guard, redirects the user to the login page when the
 * AuthService reports that there's no active session.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    public constructor(private auth: AuthService, private router: Router) {}

    public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot):
        boolean | Observable<boolean> | Promise<boolean> {
            
        // If we were never logged in we know we can return false immediately
        if (!this.auth.loggedIn)
            return this.reroute();
        
        // Check to make sure the data we have isn't expired
        if (this.auth.expiration === null || this.auth.expiration.getTime() < Date.now()) {
            // If it is expired, remove the existing data and return false
            this.auth.update(null);
            return this.reroute();
        }

        // We have non-expired data
        return true;
    }

    private reroute(): false {
        this.router.navigate(['/login']);
        return false;
    }
}
