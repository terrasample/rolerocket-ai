// cypress/e2e/job-tracking.cy.js

describe('Job Tracking Flows', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5000/login.html');
    cy.get('input[name="email"]').type('testuser+cy@rolerocketai.com');
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', 'dashboard.html');
    cy.get('a[href="job-tracking.html"]').click();
    cy.url().should('include', 'job-tracking.html');
  });

  it('shows job tracking page', () => {
    cy.contains('Find, Apply, Track');
  });

  it('can click add/import job', () => {
    cy.get('#importJobBtn').click({ force: true });
    // Add assertions for modal/dialog if present
  });
});
