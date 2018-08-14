import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Injectable()
export class LoginGuard implements CanActivate {
    public constructor(
        private auth: AuthService,
        private router: Router
    ) {}

    public canActivate(route: ActivatedRouteSnapshot) {
        if (!this.auth.loggedIn)
            return true;
        
        this.router.navigate([]);
        return false;
    }
}
