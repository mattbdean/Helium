import { expect } from 'chai';
import { StorageService } from './storage.service';

describe('StorageService', () => {
    let service: StorageService;

    beforeEach(() => {
        service = new StorageService();
        localStorage.clear();
    });

    it('should save all data in localStorage', () => {
        service.set('foo', 'bar');
        expect(localStorage.getItem('foo')).to.equal('bar');

        service.delete('foo');
        expect(localStorage.getItem('foo')).to.equal(null);
        expect(service.has('foo')).to.be.false;

        service.set('baz', 'qux');
        expect(service.has('baz')).to.be.true;
        service.delete('baz');
        expect(service.has('baz')).to.be.false;

        service.clear();
        expect(service.get('foo')).to.be.null;
    });

    after(() => {
        localStorage.clear();
    });
});
