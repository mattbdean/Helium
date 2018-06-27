import { Component } from '@angular/core';

@Component({
    template: `
        <div class="container">
            <h1 class="mat-display-1">Woah there!</h1>
            <p>This page doesn't seem to exist</p>
        </div>
    `,
    styles: [`
        h1 {
            margin: 0;
        }

        h1, p {
            text-align: center;
        }
    `]
})
export class NotFoundComponent {}
