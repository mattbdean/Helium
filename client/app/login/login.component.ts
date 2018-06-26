import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';

@Component({
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.scss']
})
export class LoginComponent {
    public form: FormGroup;

    public get previewMode() {
        return environment.preview;
    }

    public constructor(
        private fb: FormBuilder,
        private auth: AuthService,
        private snackbar: MatSnackBar,
        private router: Router
    ) {
        this.form = fb.group({
            username: ['', Validators.required],
            password: ['', Validators.required],
            host: ['', hostValidator]
        });
    }

    public onLogin(form: any) {
        this.auth.login(form).subscribe(
            () => {
                // Login was successful
                this.router.navigate(['/tables']);
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
}

function hostValidator(c: AbstractControl): ValidationErrors | null {
    const value = String(c.value);
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
