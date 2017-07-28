import { HomePage } from './app.po';

const expect = global['chai'].expect;

describe('Home page', () => {
    let page: HomePage;

    beforeEach(() => {
        page = new HomePage();
    });

    it('should display welcome message', () => {
        page.navigateTo();
        expect(page.getToolbarText()).to.eventually.equal('Helium');
    });
});
