
describe('Sidenav', () => {
    const cutoffWidth = 1480;
    const schema = 'helium_sample';
    const table = 'big_table';

    beforeEach(() => {
        cy.login();

        cy.visit('/');
        cy.get('.schema-selector-container mat-select').as('schemaSelector');
        cy.get('.sidenav-toggle').as('sidenavToggle');
        cy.get('mat-sidenav').as('sidenav');
    })

    describe('schema selector', () => {
        it('should select a schema by default', () => {
            cy.visit('/');
            cy.get('@schemaSelector').contains('helium_compound_fk_test');
        });

        it('should use the schema of whatever table/form is being shown', () => {
            cy.visit('/tables/helium_sample/big_table');
            cy.get('@schemaSelector').contains('helium_sample');

            cy.visit('/forms/helium_compound_fk_test/fk_table');
            cy.get('@schemaSelector').contains('helium_compound_fk_test');
        });

        it('should update the value when the user navigates to another table', () => {
            cy.visit('/tables/helium_cross_schema_ref_test/cross_schema_ref_test');
            cy.get('[data-constraint-type=foreign]').click();
            cy.url().should('match', /\/tables\/helium_sample\/customer$/);

            cy.get('@schemaSelector').contains('helium_sample');
        });
    });

    it('should be automatically opened on larger screens', () => {
        // Visit a page other than / so that the sidenav doesn't automatically
        // expand
        cy.visit(`/tables/${schema}/${table}`);

        const height = 600;

        // "Small" device mode, only show sidenav when toggled
        cy.viewport(cutoffWidth - 1, height);
        cy.get('@sidenav').should('not.be.visible');
        cy.get('@sidenavToggle').should('be.visible');

        // Large device mode, always show sidenav
        cy.viewport(cutoffWidth, 600);
        cy.get('@sidenav').should('be.visible');
        cy.get('@sidenavToggle').should('not.be.visible');
    });

    it('should open automatically when loading the root page on smaller screens', () => {
        cy.visit('/');

        // "Small" screen again so the toggle should be visible, but the sidenav
        // should have automatically been opened
        cy.get('@sidenav').should('be.visible');
        cy.get('@sidenavToggle').should('be.visible');
    });

    it('should change the listed tables when the schema selector is updated', () => {
        cy.get('.mat-select-trigger').click();
        cy.get('@sidenav').find('.table-name').then(($prevTables) => {
            const prevTableNames = $prevTables.map(function() { return Cypress.$(this).text(); })

            cy.get('mat-option').first().click();
            cy.get('@schemaSelector').contains('information_schema');
            cy.get('@sidenav').contains('CHARACTER_SETS');

            cy.get('@sidenav').find('.table-name').then(($newTables) => {
                const newTableNames = $newTables.map(function() { return Cypress.$(this).text(); })

                expect(prevTableNames).to.not.deep.equal(newTableNames);
            });
        });
    });

    it('should navigate to the table\'s data when its name is clicked', () => {
        cy.get('@sidenav').find('.table-name').first().click();
        cy.url().should('match', /\/tables\/helium_compound_fk_test\/fk_table$/);
    });

    it('should navigate to the table\'s form when the + button is clicked', () => {
        cy.get('@sidenav').find('.add-data-icon').first().click();
        cy.url().should('match', /\/forms\/helium_compound_fk_test\/fk_table$/);
    });
});
