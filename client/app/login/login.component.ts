import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
    templateUrl: 'login.component.html',
    styleUrls: ['login.component.scss']
})
export class LoginComponent {
    public form: FormGroup;

    public constructor(
        private fb: FormBuilder,
        private auth: AuthService,
        private snackbar: MatSnackBar,
        private router: Router
    ) {
        this.form = fb.group({
            username: ['', Validators.required],
            password: ['', Validators.required],
            host: ['']
        });
    }

    public onLogin(form: any) {
        this.auth.login(form).subscribe(
            () => {
                // Login was successful
                this.router.navigate(['/tables']);
            },
            (err: Error) => {
                let msg: string = err.message || 'An unknown error has occurred';

                if (err instanceof HttpErrorResponse && err.status < 500) {
                    msg = 'Invalid login information';
                }

                this.snackbar.open(msg, undefined, { duration: 3000 });
            }
        );
    }
}
