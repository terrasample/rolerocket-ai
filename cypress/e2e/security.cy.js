// cypress/e2e/security.cy.js

describe('Security Checks', () => {
  it('should not expose sensitive data in window or DOM', () => {
    cy.visit('http://localhost:5000');
    cy.window().then((win) => {
      expect(win.process).to.be.undefined;
      expect(win.env).to.be.undefined;
    });
    cy.document().then((doc) => {
      expect(doc.body.innerHTML).not.to.include('SECRET');
      expect(doc.body.innerHTML).not.to.include('password');
    });
  });
});
