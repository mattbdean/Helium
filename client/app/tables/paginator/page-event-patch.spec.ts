import { PageEvent } from '@angular/material';
import { expect } from 'chai';
import { cloneDeep } from 'lodash';
import { PageEventPatch } from './page-event-patch';

describe('PageEventPatch', () => {
    describe('applyTo', () => {
        const baseEvent: PageEvent = {
            pageIndex: 0,
            previousPageIndex: 0,
            pageSize: 0,
            length: 25
        };

        it('should only apply properties that PageEventPatch and PageEvent share', () => {
            const result = new PageEventPatch({ pageIndex: baseEvent.pageIndex + 1, foo: 3 } as any).applyTo(baseEvent);
            const expected = cloneDeep(baseEvent);
            expected.pageIndex = baseEvent.pageIndex + 1;
            expect(result).to.deep.equal(expected);
        });

        it('should return null when the patch has no new data', () => {
            // Everything is undefined, should be no new data
            expect(new PageEventPatch({}).applyTo(baseEvent)).to.equal(null);

            // Nothing has changed, no new data
            expect(new PageEventPatch({ pageIndex: baseEvent.pageIndex }).applyTo(baseEvent)).to.equal(null);
        });
    });
});
