// billing.js - Handles billing portal and subscription status
if (typeof apiUrl !== 'function') {
  throw new Error('apiUrl is not defined. Make sure api-base.js is loaded before billing.js');
}
const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
if (!token) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  const billingStatus = document.getElementById('billingStatus');
  const openPortalBtn = document.getElementById('openPortalBtn');
  const billingMsg = document.getElementById('billingMsg');

  if (openPortalBtn && !document.getElementById('billingRefundNote')) {
    const note = document.createElement('p');
    note.id = 'billingRefundNote';
    note.style.margin = '12px 0 0';
    note.style.color = '#64748b';
    note.style.fontSize = '0.95rem';
    note.style.lineHeight = '1.6';
    note.innerHTML = 'Need a refund review instead of a cancellation? Read the <a href="refund-policy.html">Refund Policy</a> or use <a href="contact-us.html?topic=refund">billing support</a>.';
    openPortalBtn.insertAdjacentElement('beforebegin', note);
  }

  async function loadBillingStatus() {
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.user) {
        billingStatus.innerHTML = `
          <strong>Plan:</strong> ${data.user.plan || 'free'}<br>
          <strong>Email:</strong> ${data.user.email || ''}<br>
          <strong>Status:</strong> ${data.user.isSubscribed ? 'Active' : 'Inactive'}
        `;
      } else {
        billingStatus.textContent = 'Could not load subscription info.';
      }
    } catch (err) {
      billingStatus.textContent = 'Error loading billing info.';
    }
  }

  if (openPortalBtn) {
    openPortalBtn.addEventListener('click', async () => {
      // Block Stripe for admin/lifetime/subscribed
      try {
        const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const user = data.user || {};
        if (user.isAdmin === true || user.plan === 'lifetime' || user.isSubscribed === true) {
          billingMsg.textContent = 'You already have full access. No payment required.';
          billingMsg.style.color = '#16a34a';
          openPortalBtn.disabled = true;
          return;
        }
      } catch {}
      openPortalBtn.disabled = true;
      billingMsg.textContent = 'Opening billing portal...';
      billingMsg.style.color = '#1e293b';
      try {
        const res = await fetch('/api/create-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || 'No portal URL returned');
        }
      } catch (err) {
        billingMsg.textContent = 'Failed to open billing portal: ' + err.message;
        billingMsg.style.color = '#dc2626';
      } finally {
        openPortalBtn.disabled = false;
      }
    });
  }

  await loadBillingStatus();
});
