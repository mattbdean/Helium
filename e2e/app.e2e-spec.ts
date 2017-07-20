import { HeliumPage } from './app.po';

describe('helium App', () => {
  let page: HeliumPage;

  beforeEach(() => {
    page = new HeliumPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
