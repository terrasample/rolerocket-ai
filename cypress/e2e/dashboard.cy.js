// cypress/e2e/dashboard.cy.js

describe('Dashboard Flows', () => {
  beforeEach(() => {
    // Ideally, log in via API and set token in localStorage
    cy.visit('http://localhost:5000/login.html');
    cy.get('input[name="email"]').type('testuser+cy@rolerocketai.com');
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', 'dashboard.html');
  });

  it('loads dashboard and shows user info', () => {
    cy.contains('Dashboard');
    cy.contains('Account');
  });

  it('navigates to job tracking', () => {
    cy.get('a[href="job-tracking.html"]').click();
    cy.url().should('include', 'job-tracking.html');
  });
});
