// cypress/e2e/payment.cy.js

describe('Payment Flows', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5000/login.html');
    cy.get('input[name="email"]').type('testuser+cy@rolerocketai.com');
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', 'dashboard.html');
  });

  it('navigates to pricing and starts checkout', () => {
    cy.get('a[href="pricing.html"]').click();
    cy.url().should('include', 'pricing.html');
    cy.contains('Unlock Pro').click({ multiple: true, force: true });
    // Should redirect to Stripe checkout (mock or check for redirect)
  });
});
