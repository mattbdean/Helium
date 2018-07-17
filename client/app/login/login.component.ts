import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { RedirectInfo } from './redirect-info';

@Component({
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
    public form: FormGroup;

    public redirect: RedirectInfo | null = null;
    @ViewChild('password') public passwordField: ElementRef;
    private sub: Subscription | null = null;

    public get previewMode() {
        return environment.preview;
    }

    public constructor(
        private fb: FormBuilder,
        private auth: AuthService,
        private snackbar: MatSnackBar,
        private router: Router,
        private route: ActivatedRoute
    ) {}

    public ngOnInit() {
        this.form = this.fb.group({
            username: ['', Validators.required],
            password: ['', Validators.required],
            host: ['', LoginComponent.hostValidator]
        });

        this.sub = this.route.queryParamMap.pipe(
            map((query): RedirectInfo | null => {
                const fromUser = query.get('from_user');
                const fromPath = query.get('from_path');
                const fromHost = query.get('from_host');

                if (fromUser === null || fromPath === null || fromHost === null)
                    return null;

                const parts = fromPath.split('?');
                if (parts.length > 2) {
                    // tslint:disable-next-line:no-console
                    console.warn('Expected from_path to contain at most one \'?\', got', fromPath);
                    return null;
                }

                return {
                    user: fromUser,
                    path: parts[0],
                    host: fromHost,
                    query: LoginComponent.parseQueryString(parts[1])
                };
            })
        ).subscribe((data) => {
            this.redirect = data;
            if (data !== null)
                this.form.setValue({
                    username: data.user,
                    password: '',
                    host: data.host
                });
        });
    }

    public ngOnDestroy() {
        if (this.sub)
            this.sub.unsubscribe();
    }

    public onLogin(form: any) {
        this.auth.login(form).subscribe(
            () => {
                let path = 'tables';
                let query: { [key: string]: string } = {};

                if (this.redirect) {
                    if (form.username === this.redirect.user && form.host === this.redirect.host) {
                        path = this.redirect.path;
                        if (path.startsWith('/'))
                            path = path.slice(1);
                        query = this.redirect.query;
                    }
                }

                // Login was successful
                this.router.navigate(['/', ...path.split('/')], { queryParams: query });
            },
            (err: any) => {
                let msg: string = 'An unknown error has occurred';

                if (err instanceof HttpErrorResponse && err.status < 500) {
                    msg = 'Invalid login information';
                }

                if (err instanceof Error)
                    msg = err.message;
                
                this.snackbar.open(msg, undefined, { duration: 3000 });
            }
        );
    }

    public hasError(control: string, error: string): boolean {
        const ctrl = this.form.controls[control];
        return ctrl.errors !== null && ctrl.errors[error] !== undefined;
    }

    public static createRedirectQuery(data: { username: string, host: string, path: string }): Params {
        return {
            from_user: data.username,
            from_host: data.host,
            from_path: data.path
        };
    }

    public static parseQueryString(query?: string): { [key: string]: string } {
        const data: { [key: string]: string } = {};

        // Nothing to do
        if (query === undefined || query.trim() === '')
            return data;

        const pairs = query.split('&');
        for (const pair of pairs) {
            // If there are multiple '=' signs, we only care about the first.
            // "foo=bar=baz" would means "foo" is the key and "bar=baz" is the
            // value.
            const firstIndex = pair.indexOf('=');

            const key = firstIndex < 0 ? pair : pair.slice(0, firstIndex);

            // If multiple keys are specified, we only care the first time that
            // key is mentioned
            if (data[key])
                continue;

            // If there is no '=' in the key-value pair, then there is no value
            data[key] = firstIndex < 0 ? '' : pair.slice(firstIndex + 1);
        }

        return data;
    }

    public static validateHost(value: string): ValidationErrors | null {
        // No value is okay, defaults to localhost
        if (value.trim().length === 0)
            return null;

        // A colon separates the host from the port, make sure there is at most one
        // colon.
        const parts = value.split(':');
        for (const part of parts) {
            if (part.trim().length === 0)
                return { host: 'empty part' };
        }
        return parts.length > 2 ? { host: 'parts > 2' } : null;
    }
    
    public static hostValidator(c: AbstractControl): ValidationErrors | null {
        return LoginComponent.validateHost(String(c.value));
    }
}
