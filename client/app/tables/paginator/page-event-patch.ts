import { PageEvent } from '@angular/material';
import { cloneDeep } from 'lodash';

/**
 * A class capable of "patching" an existing PageEvent. See `applyTo` for more.
 */
export class PageEventPatch implements Partial<PageEvent> {
    public readonly pageIndex?: number;
    public readonly previousPageIndex?: number;
    public readonly pageSize?: number;
    public readonly length?: number;

    constructor(data: Partial<PageEvent>) {
        this.pageIndex = data.pageIndex;
        this.previousPageIndex = data.previousPageIndex;
        this.pageSize = data.pageSize;
        this.length = data.length;
    }

    /**
     * Clones the given event, sets all defined, PageEvent-related members of
     * `this` to the new event, and returns it. Returns null instead if there
     * is no new data.
     */
    public applyTo(event: PageEvent): PageEvent | null {
        const properties: Array<keyof PageEventPatch> = [
            'pageIndex',
            'previousPageIndex',
            'pageSize',
            'length'
        ];

        let hasNewData = false;
        const newEvent = cloneDeep(event);
        for (const property of properties) {
            if (this[property] !== undefined && newEvent[property] !== this[property]) {
                newEvent[property] = this[property];
                hasNewData = true;
            }
        }

        // Make sure calling this function with an empty object doesn't emit
        // events
        return hasNewData ? newEvent : null;
    }
}
