// nav-plan-sync.js — Updates the plan badge in the sidebar nav on any page
// Include this script on all public/marketing pages to keep the plan display accurate.
(function () {
  const NAV_LABELS = {
    'index.html': '🏠 Home',
    'about-us.html': '📖 About Us',
    'features.html': '✨ Features',
    'job-tracking.html': '🔎 Find, Search & Track',
    'ai-recruiter-assist.html': '🤖 AI Recruiter Assist',
    'pricing.html': '💳 Pricing',
    'contact-us.html': '📬 Contact Us',
    'jamaica-workforce-accelerator.html': '🇯🇲 Jamaica Workforce Accelerator',
    'job-alerts-sms.html': '📱 Job Alerts',
    'institution-cohort-manager.html': '🏫 Cohort Manager',
    'account.html': '👤 Account',
    'dashboard.html': '🧑‍💼 My Dashboard',
    'login.html': '🚪 Logout'
  };

  function normalizePath(href) {
    try {
      const url = new URL(href, window.location.href);
      return String(url.pathname.split('/').pop() || '').toLowerCase();
    } catch (_) {
      return String(href || '').toLowerCase();
    }
  }

  function insertAfter(node, target) {
    if (!node || !target || !target.parentNode) return;
    target.parentNode.insertBefore(node, target.nextSibling);
  }

  function ensureSectionLabel(nav, beforeNode, key, text) {
    if (!nav || !beforeNode) return;
    const existing = nav.querySelector(`.sidebar-section-label[data-section="${key}"]`);
    if (existing) return;
    const label = document.createElement('p');
    label.className = 'sidebar-section-label';
    label.setAttribute('data-section', key);
    label.textContent = text;
    nav.insertBefore(label, beforeNode);
  }

  function decorateSidebarNav() {
    const nav = document.querySelector('#sidebarNav nav, .sidebar nav');
    if (!nav) return;

    const allLinks = Array.from(nav.querySelectorAll('a.sidebar-link-btn'));
    if (!allLinks.length) return;

    const seen = new Set();
    allLinks.forEach((link) => {
      const path = normalizePath(link.getAttribute('href') || '');
      if (path && NAV_LABELS[path]) {
        link.textContent = NAV_LABELS[path];
      }

      // Remove accidental duplicate nav rows with same href.
      const dedupeKey = path + '|' + String(link.textContent || '').trim();
      if (seen.has(dedupeKey)) {
        link.remove();
        return;
      }
      seen.add(dedupeKey);
    });

    const links = Array.from(nav.querySelectorAll('a.sidebar-link-btn'));
    const findByPath = (p) => links.find((l) => normalizePath(l.getAttribute('href') || '') === p);

    const jamaica = findByPath('jamaica-workforce-accelerator.html');
    const jobAlerts = findByPath('job-alerts-sms.html');
    const cohort = findByPath('institution-cohort-manager.html');
    const account = findByPath('account.html');

    if (jamaica) {
      ensureSectionLabel(nav, jamaica, 'jamaica', 'JAMAICA HUB');

      // Keep Jamaica tools clustered directly after the hub entry.
      if (jobAlerts) insertAfter(jobAlerts, jamaica);
      if (cohort) insertAfter(cohort, jobAlerts || jamaica);
    }

    if (account) {
      ensureSectionLabel(nav, account, 'account', 'ACCOUNT');
    }
  }

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

  function bootstrapNav() {
    decorateSidebarNav();
    syncNavPlan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapNav);
  } else {
    bootstrapNav();
  }
})();
