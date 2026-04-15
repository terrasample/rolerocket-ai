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
