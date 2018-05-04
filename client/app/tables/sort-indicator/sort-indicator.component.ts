import { Component, Input } from '@angular/core';
import { SortDirection } from '@angular/material';

/**
 * All this component does is show an icon based on its state. If the state
 * indicates an ascending sort, it shows an upwards-facing arrow, etc.
 */
@Component({
    selector: 'sort-indicator',
    template: `
        <mat-icon>{{ iconName }}</mat-icon>
    `,
    styles: [`
        mat-icon {
            transform: scale(0.7);
        }
    `]
})
export class SortIndicatorComponent {
    @Input()
    public state: SortDirection = '';

    public get iconName(): string {
        if (this.state === 'asc')
            return 'arrow_upward';
        else if (this.state === 'desc')
            return 'arrow_downward';
        else
            return '';
    }

    /**
     * Switches to and returns the next sorting direction. Behaves in a circular
     * pattern: (none) --> asc --> desc --> (none) and so on.
     */
    public nextSort(): SortDirection {
        if (this.state === '')
            this.state = 'asc';
        else if (this.state === 'asc')
            this.state = 'desc';
        else if (this.state === 'desc')
            this.state = '';

        return this.state;
    }
}
