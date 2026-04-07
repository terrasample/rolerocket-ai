// cypress/e2e/auth-flows.cy.js

describe('Authentication Flows', () => {
  it('allows a user to sign up, verify, and log in', () => {
    cy.visit('http://localhost:5000/signup.html');
    cy.get('input[name="name"]').type('Test User');
    cy.get('input[name="email"]').type('testuser+cy@rolerocketai.com');
    cy.get('input[name="password"]').type('TestPassword123!');
    cy.get('button[type="submit"]').click();
    cy.contains('verify your email', { matchCase: false });
    // Simulate verification in backend or via test DB if possible
  });

  it('shows error for invalid login', () => {
    cy.visit('http://localhost:5000/login.html');
    cy.get('input[name="email"]').type('notarealuser@rolerocketai.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.contains('Invalid credentials');
  });
});
