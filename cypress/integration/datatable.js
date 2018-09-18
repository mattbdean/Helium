describe('Datatable', () => {
    beforeEach(() => {
        cy.login();
        cy.visit('/tables/helium_sample/order');
        // Wait for SVGs to load, generally means page is loaded
        cy.get('mat-header-cell').find('svg');
    })

    describe('filters', () => {
        beforeEach(() => {
            cy.get('[data-cy-toggle-filters-button]').as('filtersToggle');
        });

        it('should show/hide filters when the button is pressed', () => {
            cy.get('filter').should('not.be.visible');
            cy.get('@filtersToggle').click();
            cy.get('filter').should('be.visible').then((filters$) => {
                expect(filters$).to.have.lengthOf(1);
                cy.get('@filtersToggle').click();
                cy.get('filter').should('not.be.visible');
            });
        });

        it('should hide the filters when the last filter is removed', () => {
            cy.get('@filtersToggle').click();
            cy.get('[data-cy-remove-filter-button]').click();

            // Removing the last filter should do exactly the same thing as
            // resetting the filter and toggling the filters again
            cy.get('filter').should('not.be.visible');
            cy.get('@filtersToggle').click();
            cy.get('filter').should('be.visible').then((filters$) => {
                expect(filters$).to.have.lengthOf(1);
            })
        });

        it('should exclude a filter if it\'s unchecked', () => {
            cy.get('mat-row').then((rows$) => {
                expect(rows$).to.have.length.above(0);
                const originalLength = rows$.length;

                // Open the filters
                cy.get('@filtersToggle').click();

                // Select column 'order_id'
                cy.get('filter mat-select').first().click();
                cy.get('mat-option').contains('order_id').click();

                // Select filter operation 'Equal To'
                cy.get('filter mat-select').eq(1).click();
                cy.get('mat-option').contains('Equal To').click();

                // Select value '40'
                cy.get('filter input.mat-input-element').type('40');

                // There should only be 1 row matching this filter
                cy.get('mat-row').should('have.length', 1);

                // Disable the filter
                cy.get('filter mat-checkbox').click();
                cy.get('mat-row').should('have.length', originalLength);
                cy.get('filter mat-card').should('have.class', 'disabled');

                // Enable the filter again
                cy.get('filter mat-checkbox').click();
                cy.get('mat-row').should('have.length', 1);
            })
        });

        it('should add a new filter when the Add Filter button is pressed', () => {
            cy.get('@filtersToggle').click();
            cy.get('filter').should('have.length', 1);

            cy.get('.add-filter-button').click();
            cy.get('filter').should('have.length', 2);
        });
    });

    describe('status bar', () => {
        it('should update the manual page input when using the next/prev page buttons', () => {
            cy.visit('/tables/helium_sample/big_table');
            cy.get('.page-selector input').should('have.value', '1');

            // Press the next button
            cy.get('button.mat-paginator-navigation-next').click();
            cy.get('.page-selector input').should('have.value', '2');

            // Press the previous button
            cy.get('button.mat-paginator-navigation-previous').click();
            cy.get('.page-selector input').should('have.value', '1');
        });
    });

    it('should allow sorting by clicking the header', () => {
        cy.get('mat-header-cell').contains('order_id').parent('mat-header-cell').as('header')
            .click().find('sort-indicator').contains('arrow_upward');
    });

    it('should navigate to the referenced table when the foreign key icon is clicked', () => {
        cy.get('mat-header-cell').contains('organization_id').parent('mat-header-cell')
            .find('[data-constraint-type=foreign]').click();
        
        cy.url().should('match', /\/helium_sample\/organization$/);
    });

    it('should update the query whenever the state is changed', () => {
        cy.visit('/tables/helium_sample/big_table');
        cy.get('mat-header-cell').find('svg');

        cy.location('search').should('equal', '');

        // Manual page input
        cy.get('.page-selector input').type('2');
        cy.location('search').should('equal', '?page=12');

        // Page size selector
        cy.get('paginator mat-select').click();
        cy.get('mat-option').contains('5').click();
        cy.location('search').should('equal', '?page=56&pageSize=5');

        // Sorting
        cy.get('mat-header-cell').contains('pk').parent('mat-header-cell').as('header').click();
        cy.location('search').should('equal', '?page=56&pageSize=5&sort=pk');
        cy.get('@header').click();
        cy.location('search').should('equal', '?page=56&pageSize=5&sort=-pk');
    });

    it('should redirect to a form when the Copy To Form button is pressed', () => {
        cy.get('[data-cy-copy-to-form]').first().click();
        cy.location('pathname').should('equal', '/forms/helium_sample/order');
        cy.location('search').should('equal', '?order_id=40&organization_id=10&customer_id=0&product_id=20');
    });

    // TODO
    it('should allow columns to be resized');
});
