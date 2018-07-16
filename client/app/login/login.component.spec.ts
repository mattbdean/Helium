import { DebugElement } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import {
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
} from '@angular/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { expect } from 'chai';
import { of, throwError } from 'rxjs';
import * as sinon from 'sinon';
import { AuthService } from '../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
    let fixture: ComponentFixture<LoginComponent>;
    let comp: LoginComponent;
    let authService: AuthService;
    let router: Router;
    let activatedRoute: ActivatedRoute;

    const authServiceStub = {
        login: () => { throw new Error('AuthService.login() not stubbed'); }
    };

    const routerStub = {
        navigate: () => { throw new Error('Router.navigate() not stubbed'); }
    };

    const activatedRouteStub = {
        queryParamMap: throwError(new Error('ActivatedRoute.queryParamMap not stubbed'))
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [ LoginComponent ],
            imports: [
                ReactiveFormsModule,
                MatButtonModule,
                MatSnackBarModule,
                MatFormFieldModule,
                MatInputModule,
                MatCardModule,
                NoopAnimationsModule
            ],
            providers: [
                { provide: AuthService, useValue: authServiceStub },
                { provide: Router, useValue: routerStub },
                { provide: ActivatedRoute, useValue: activatedRouteStub }
            ]
        });

        fixture = TestBed.createComponent(LoginComponent);
        comp = fixture.componentInstance;

        authService = TestBed.get(AuthService);
        router = TestBed.get(Router);
        activatedRoute = TestBed.get(ActivatedRoute);
    });

    it('should attempt to log in when the form is submitted', () => {
        // No query data
        sinon.stub(activatedRoute, 'queryParamMap').get(() => of(convertToParamMap({})));
        const loginStub = sinon.stub(authService, 'login').returns(of());
        fixture.detectChanges();

        comp.form.setValue({
            username: 'foo',
            password: 'bar',
            host: 'baz'
        });

        comp.onLogin(comp.form.value);

        expect(loginStub).calledWithExactly({ username: 'foo', password: 'bar', host: 'baz' });
    });

    it('should fill the username and host based on the values of the from_user and from_host query params', () => {
        sinon.stub(activatedRoute, 'queryParamMap').get(() => of(convertToParamMap({
            from_user: 'luser',
            from_host: 'some_host',
            from_path: '/foo/bar'
        })));
        fixture.detectChanges();

        expect(comp.form.value).to.deep.equal({
            username: 'luser',
            password: '',
            host: 'some_host'
        });
    });

    it('should only redirect to the requested path if the final username/host ' +
        'matches the ones in the query', () => {

        sinon.stub(activatedRoute, 'queryParamMap').get(() => of(convertToParamMap({
            from_user: 'luser',
            from_host: 'some_host',
            from_path: '/foo/bar?hello=world'
        })));
        fixture.detectChanges();

        sinon.stub(authService, 'login').returns(of(null));
        const navigateStub = sinon.stub(router, 'navigate').resolves(true);

        comp.onLogin(comp.form.value);

        expect(navigateStub).calledWithExactly(['/', 'foo', 'bar'], { queryParams: { hello: 'world' }});
    });

    describe('#parseQueryString', () => {
        it('should return an object with no properties when given an undefined or empty string', () => {
            expect(LoginComponent.parseQueryString(undefined)).to.deep.equal({});
            expect(LoginComponent.parseQueryString('')).to.deep.equal({});
        });

        it('should handle one or more key-value pairs', () => {
            expect(LoginComponent.parseQueryString('foo=bar'))
                .to.deep.equal({ foo: 'bar' });
            expect(LoginComponent.parseQueryString('foo=bar&baz=qux'))
                .to.deep.equal({ foo: 'bar', baz: 'qux' });
        });

        it('should only pay attention to the first "=" for key/value detection', () => {
            expect(LoginComponent.parseQueryString('foo=bar=baz'))
                .to.deep.equal({ foo: 'bar=baz' });
        });

        it('should use an empty string when there is no provided value', () => {
            expect(LoginComponent.parseQueryString('foo'))
                .to.deep.equal({ foo: '' });
        });

        it('should only pay attention to the first time a key is mentioned', () => {
            expect(LoginComponent.parseQueryString('foo=bar&foo=baz'))
                .to.deep.equal({ foo: 'bar' });
        });
    });

    describe('#validateHost', () => {
        it('should return null when there is no input', () => {
            expect(LoginComponent.validateHost('')).to.be.null;
        });

        it('should return a non-null value when there is more than one ":"', () => {
            expect(LoginComponent.validateHost('foo:bar:baz')).to.not.be.null;
        });
    });
});
