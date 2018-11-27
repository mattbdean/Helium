import {
    Component, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { MatIconRegistry, MatSnackBar } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { fromEvent, Observable, Subscription } from 'rxjs';
import { delay, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { SessionPing } from './common/api';
import { AuthService } from './core/auth/auth.service';
import { LoginComponent } from './login/login.component';
import { SidenavComponent, ToggleMode } from './sidenav/sidenav.component';

/**
 * The AppComponent is the ultimate parent of every other component in the app.
 */
@Component({
    selector: 'app',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss']
})
export class AppComponent implements OnDestroy, OnInit {
    /**
     * If the width of the browser (in pixels) is above this value, the sidenav
     * will always be shown.
     */
    public static readonly ALWAYS_SHOW_SIDENAV_WIDTH = 1480;

    public toggleMode$: Observable<ToggleMode>;
    public showable$: Observable<boolean>;

    private windowWidth$: Observable<number>;

    @ViewChild(SidenavComponent)
    public sidenav: SidenavComponent;

    private expirationTimerSub: Subscription;

    public constructor(
        public auth: AuthService,
        private router: Router,
        private iconReg: MatIconRegistry,
        private domSanitizer: DomSanitizer,
        private snackBar: MatSnackBar
    ) {}

    public ngOnInit() {
        // Make these icons available
        this.registerSvgIcons(['filter', 'key-change', 'key', 'snowflake', 'download']);

        this.windowWidth$ = fromEvent(window, 'resize').pipe(
            map(() => window.innerWidth),
            // Start with a value so adjustSidenav gets called on init
            startWith(window.innerWidth)
        );
        
        this.toggleMode$ = this.windowWidth$.pipe(
            map((width: number) =>
                width >= AppComponent.ALWAYS_SHOW_SIDENAV_WIDTH ? 'alwaysDisplayed' : 'toggleRequired'),
            distinctUntilChanged<ToggleMode>()
        );

        this.showable$ = this.auth.watchAuthState().pipe(
            // Delay by 1ms to wait until next change detection cycle
            delay(1)
        );

        // The session has expired
        this.expirationTimerSub = this.auth.expirationTimer().pipe(
            switchMap(() => {
                // Ping the API to make absolutely sure
                return this.auth.ping().pipe(
                    map((ping: SessionPing) =>
                        // Consider a token invalid if it's gonna expire in the
                        // next second
                        ping.validApiKey && ping.expiresAt && Date.now() < ping.expiresAt - 1000
                    )
                );
            })
        ).subscribe((valid: boolean) => {
            if (!valid) {
                // Expired, log out and redirect
                this.logout('Your session has expired');
            }
        });
    }

    public ngOnDestroy() {
        this.expirationTimerSub.unsubscribe();
    }

    public logout(message?: string, redirectInfo: boolean = true) {
        if (message)
            this.snackBar.open(message, 'OK', {
                duration: 2000
            });

        // Log the user out
        this.auth.logout();

        const data = this.auth.lastValidAuthData;

        // Automatically redirect to the login page
        const query = redirectInfo && data !== null ? LoginComponent.createRedirectQuery({
            username: data.username,
            host: data.host,
            path: this.router.url
        }) : {};
        return this.router.navigate(['/login'], { queryParams: query });
    }

    /**
     * Makes the icons with the provided names usable by MatIcon. Each SVG file
     * must be located at `${baseUrl}/assets/${iconName}.svg`. The icons are
     * registerd under the `app` namespace. To use:
     * 
     *     <mat-icon [svgIcon]="app:iconName"></mat-icon>
     */
    private registerSvgIcons(names: string[]) {
        for (const svgIcon of names) {
            const safeUrl = this.domSanitizer.bypassSecurityTrustResourceUrl(
                `${environment.baseUrl}assets/${svgIcon}.svg`);
                
            this.iconReg.addSvgIconInNamespace('app', svgIcon, safeUrl);
        }
    }
}
