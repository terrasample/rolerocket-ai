// nav-plan-sync.js — Updates the plan badge in the sidebar nav on any page
// Include this script on all public/marketing pages to keep the plan display accurate.
(function () {
  function formatPlanLabel(plan) {
    const map = {
      free: 'Free Plan',
      pro: 'Pro Plan',
      premium: 'Premium Plan',
      elite: 'Elite Plan',
      lifetime: 'Lifetime Access',
    };
    const key = String(plan || '').toLowerCase();
    return map[key] || (plan ? plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan' : 'Free Plan');
  }

  async function syncNavPlan() {
    const badge = document.getElementById('planBadge');
    if (!badge) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    if (!token) return; // Not logged in — keep "Free Plan" default

    try {
      const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
      const res = await fetch(apiBase + '/api/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const plan = (data.user && data.user.plan) || 'free';
      badge.textContent = formatPlanLabel(plan);
    } catch (_) {
      // Silently ignore — badge stays at default
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncNavPlan);
  } else {
    syncNavPlan();
  }
})();
