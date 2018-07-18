import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    Router,
    RouterStateSnapshot
} from '@angular/router';
import { Observable } from 'rxjs';
import { LoginComponent } from '../../login/login.component';
import { AuthData } from '../auth-data/auth-data.interface';
import { AuthService } from '../auth/auth.service';

/**
 * When used as a route guard, redirects the user to the login page when the
 * AuthService reports that there's no active session.
 */
@Injectable()
export class AuthGuard implements CanActivate {
    public constructor(private auth: AuthService, private router: Router) {}

    public canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot):
        boolean | Observable<boolean> | Promise<boolean> {
        
        // Check to make sure the data we have isn't expired
        if (this.auth.expiration === null || this.auth.expiration.getTime() < Date.now()) {
            // If it is expired, remove the existing data and return false
            this.auth.update(null);
            return this.reroute(this.auth.lastValidAuthData, state.url);
        }

        // We have non-expired data
        return true;
    }

    private reroute(lastValidAuthData: AuthData | null, url: string): false {
        this.router.navigate(['/login'], {
            queryParams: lastValidAuthData === null ? {} : LoginComponent.createRedirectQuery({
                username:  lastValidAuthData.username,
                host: lastValidAuthData.host,
                path: url
            })
        });
        return false;
    }
}
