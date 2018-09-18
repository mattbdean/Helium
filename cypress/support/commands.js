// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

Cypress.Commands.add('login', (user, password, host) => {
    cy.request('POST', '/api/v1/login', {
        username: user || 'user',
        password: password || 'password',
        host: host || ''
    }).then((res) => {
        expect(res.body).to.have.property('apiKey');
        expect(res.headers).to.have.property('x-session-expiration');
        localStorage.setItem('apiKey', res.body.apiKey);
        localStorage.setItem('expiration', res.headers['x-session-expiration']);
        localStorage.setItem('host', host || '');
        localStorage.setItem('username', user || 'user');
    });
});
