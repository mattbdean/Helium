
describe('Authentication', () => {
    beforeEach(() => {
        cy.visit('/');
        cy.get('input[formcontrolname=username]').as('username');
        cy.get('input[formcontrolname=password]').as('password');
        cy.get('input[formcontrolname=host]').as('host');
        cy.get('button[mat-raised-button]').as('loginButton');
    });

    it('should redirect to /login when not authenticated', () => {
        const paths = ['/', '/tables', '/forms'];
        for (const path of paths) {
            cy.visit(path);
            cy.url().should('match', /\/login$/);
        }
    });

    it('should not require a host', () => {
        cy.get('@loginButton').should('be.disabled');
        cy.get('@username').type('user');
        cy.get('@password').type('password');
        cy.get('@loginButton').should('not.be.disabled');
    });

    it('should mark the relevant input as invalid if there is no value', () => {
        for (const name of ['@username', '@password']) {
            cy.get(name).type('foo').clear().blur().should('have.class', 'ng-invalid');
        }

        cy.get('@host').type('foo').clear().blur().should('not.have.class', 'ng-invalid');
    });

    it('should use a snackbar to notify the user of invalid credentials', () => {
        cy.get('@username').type('invalid');
        cy.get('@password').type('invalid');
        cy.get('@loginButton').should('not.be.disabled').click();

        cy.get('snack-bar-container').should('be.visible').contains('Invalid login information');
    });

    it('should not allow the sidenav to be toggled', () => {
        cy.get('button.sidenav-toggle').should('not.be.visible');
    });
});
