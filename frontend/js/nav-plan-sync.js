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
    'profile.html': '🧑 My Profile',
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

    // Inject "My Profile" link if not already present in this nav.
    ensureProfileLink(nav);
  }

  function ensureProfileLink(nav) {
    if (!nav) return;
    // Don't inject on pages that have no authenticated nav (login, signup, etc.)
    const currentPage = normalizePath(window.location.href) || 'index.html';
    const noAuthPages = ['login.html', 'signup.html', 'forgot-password.html', 'reset-password.html', 'verify-email.html', 'terms.html', 'privacy.html', 'refund-policy.html'];
    if (noAuthPages.includes(currentPage)) return;

    // Already present — just ensure label and active state are correct.
    let existing = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
      .find((l) => normalizePath(l.getAttribute('href') || '') === 'profile.html');

    if (!existing) {
      existing = document.createElement('a');
      existing.className = 'sidebar-link-btn';
      existing.href = 'profile.html';

      // Insert before Jamaica Hub, or before account.html, or append as fallback.
      const jamaicaLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => normalizePath(l.getAttribute('href') || '') === 'jamaica-workforce-accelerator.html');
      const accountLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => normalizePath(l.getAttribute('href') || '') === 'account.html');
      // Also check for the Jamaica section label so we insert before it
      const jamaicaLabel = nav.querySelector('.nav-section-label[data-section="jamaica"]');
      const anchor = jamaicaLabel || jamaicaLink || accountLink;
      if (anchor) {
        nav.insertBefore(existing, anchor);
      } else {
        nav.appendChild(existing);
      }
    }

    existing.textContent = '🧑 My Profile';
    if (currentPage === 'profile.html') {
      existing.classList.add('active');
    }
  }

  function upsertAdminInvitesLink(isAdmin) {
    const nav = document.querySelector('#sidebarNav nav, .sidebar nav');
    if (!nav) return;

    let adminLink = nav.querySelector('a.sidebar-link-btn[data-nav-admin="1"]')
      || nav.querySelector('a.sidebar-link-btn#adminInvitesLink')
      || Array.from(nav.querySelectorAll('a.sidebar-link-btn')).find((l) => normalizePath(l.getAttribute('href') || '') === 'admin-institution-invites.html');

    if (!isAdmin) {
      if (adminLink) adminLink.remove();
      return;
    }

    if (!adminLink) {
      adminLink = document.createElement('a');
      adminLink.className = 'sidebar-link-btn';
      adminLink.href = 'admin-institution-invites.html';
      adminLink.setAttribute('data-nav-admin', '1');
    }

    adminLink.id = 'adminInvitesLink';
    adminLink.textContent = '🔑 Admin Invites';
    adminLink.style.display = '';

    const accountLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
      .find((l) => normalizePath(l.getAttribute('href') || '') === 'account.html');
    if (accountLink) {
      nav.insertBefore(adminLink, accountLink);
    } else if (!adminLink.parentNode) {
      nav.appendChild(adminLink);
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
    if (!badge) {
      upsertAdminInvitesLink(false);
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    if (!token) {
      upsertAdminInvitesLink(false);
      return; // Not logged in — keep "Free Plan" default
    }

    try {
      const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
      const res = await fetch(apiBase + '/api/me', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!res.ok) {
        upsertAdminInvitesLink(false);
        return;
      }
      const data = await res.json();
      const plan = (data.user && data.user.plan) || 'free';
      const isAdmin = !!(data.user && data.user.isAdmin);
      badge.textContent = formatPlanLabel(plan);
      upsertAdminInvitesLink(isAdmin);
    } catch (_) {
      upsertAdminInvitesLink(false);
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
