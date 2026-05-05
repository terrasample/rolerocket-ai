// nav-plan-sync.js — Updates the plan badge in the sidebar nav on any page
// Include this script on all public/marketing pages to keep the plan display accurate.
(function () {
  const ADMIN_CACHE_KEY = 'rr_nav_is_admin_v1';

  const NAV_LABELS = {
    'index.html': '🏠 Home',
    'about-us.html': '📖 About Us',
    'features.html': '✨ Features',
    'networking-ai.html': '🤝 Networking Hub',
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
    const nav = document.querySelector('#sidebarNav nav, .sidebar nav, #sidebarNav, .sidebar');
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

    ensureNetworkingHubLink(nav);
    const jamaica = findByPath('jamaica-workforce-accelerator.html');

    // Section labels are now baked into every page's HTML; only inject if missing.
    if (jamaica) ensureSectionLabel(nav, jamaica, 'jamaica', 'JAMAICA HUB');
    const profileLink = findByPath('profile.html');
    if (profileLink) ensureSectionLabel(nav, profileLink, 'account', 'ACCOUNT');

    // Inject "My Profile" link if not already present in this nav.
    ensureProfileLink(nav);

    // Normalize sidebar order so users see a stable nav across all pages.
    stabilizeNavOrder(nav);
  }

  function stabilizeNavOrder(nav) {
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('a.sidebar-link-btn'));
    const findByPath = (p) => links.find((l) => normalizePath(l.getAttribute('href') || '') === p);

    const hr = nav.querySelector('hr');
    const planBadge = nav.querySelector('#planBadge');
    const logoutLink = findByPath('login.html');

    const prePlanOrder = [
      'index.html',
      'about-us.html',
      'features.html',
      'networking-ai.html',
      'job-tracking.html',
      'ai-recruiter-assist.html',
      'pricing.html',
      'contact-us.html',
      'jamaica-workforce-accelerator.html',
      'institution-cohort-manager.html'
    ];

    const firstSecondaryLink =
      findByPath('institution-cohort-manager.html') ||
      findByPath('profile.html') ||
      findByPath('dashboard.html') ||
      findByPath('job-alerts-sms.html') ||
      findByPath('account.html') ||
      findByPath('admin-institution-invites.html') ||
      logoutLink;

    const coreAnchor = hr || planBadge || firstSecondaryLink || null;

    // Keep core links before the plan divider in a fixed order.
    prePlanOrder.forEach((path) => {
      const link = findByPath(path);
      if (!link) return;
      if (coreAnchor) {
        nav.insertBefore(link, coreAnchor);
      }
    });

    // Keep account-area links in a fixed order below plan badge and before logout.
    const accountOrder = [
      'profile.html',
      'dashboard.html',
      'job-alerts-sms.html',
      'account.html',
      'admin-institution-invites.html'
    ];

    accountOrder.forEach((path) => {
      const link = findByPath(path);
      if (!link) return;
      if (logoutLink) {
        nav.insertBefore(link, logoutLink);
      } else {
        nav.appendChild(link);
      }
    });

    // Keep section labels attached to their first link after reordering.
    const jamaicaLink = findByPath('jamaica-workforce-accelerator.html');
    if (jamaicaLink) {
      const jamaicaLabel = nav.querySelector('.sidebar-section-label[data-section="jamaica"]');
      if (jamaicaLabel) nav.insertBefore(jamaicaLabel, jamaicaLink);
    }
    const profileLink = findByPath('profile.html');
    if (profileLink) {
      const accountLabel = nav.querySelector('.sidebar-section-label[data-section="account"]');
      if (accountLabel) nav.insertBefore(accountLabel, profileLink);
    }
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

      // Insert near account/logout so adding this link does not reshuffle primary nav order.
      const accountLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => normalizePath(l.getAttribute('href') || '') === 'account.html');
      const logoutLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => normalizePath(l.getAttribute('href') || '') === 'login.html');
      const anchor = accountLink || logoutLink;
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

  function ensureNetworkingHubLink(nav) {
    if (!nav) return null;

    const currentPage = normalizePath(window.location.href) || 'index.html';
    let existing = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
      .find((l) => normalizePath(l.getAttribute('href') || '') === 'networking-ai.html');

    if (!existing) {
      existing = document.createElement('a');
      existing.className = 'sidebar-link-btn';
      existing.href = 'networking-ai.html';

      const allLinks = Array.from(nav.querySelectorAll('a.sidebar-link-btn'));
      const featuresLink = allLinks.find((l) => normalizePath(l.getAttribute('href') || '') === 'features.html');
      const jobTrackingLink = allLinks.find((l) => normalizePath(l.getAttribute('href') || '') === 'job-tracking.html');

      if (jobTrackingLink) {
        nav.insertBefore(existing, jobTrackingLink);
      } else if (featuresLink) {
        insertAfter(existing, featuresLink);
      } else {
        nav.appendChild(existing);
      }
    }

    existing.textContent = '🤝 Networking Hub';
    existing.classList.toggle('active', currentPage === 'networking-ai.html');
    return existing;
  }

  function upsertAdminInvitesLink(isAdmin) {
    const nav = document.querySelector('#sidebarNav nav, .sidebar nav, #sidebarNav, .sidebar');
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

    // Place admin link after Account, before Logout — matching canonical HTML order.
    const logoutLink = Array.from(nav.querySelectorAll('a.sidebar-link-btn'))
      .find((l) => normalizePath(l.getAttribute('href') || '').startsWith('login.html'));
    if (logoutLink) {
      nav.insertBefore(adminLink, logoutLink);
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

  function readCachedAdminState() {
    try {
      const raw = String(localStorage.getItem(ADMIN_CACHE_KEY) || '').toLowerCase();
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (_) {
      // ignore storage access failures
    }
    return null;
  }

  function writeCachedAdminState(isAdmin) {
    try {
      localStorage.setItem(ADMIN_CACHE_KEY, isAdmin ? '1' : '0');
    } catch (_) {
      // ignore storage access failures
    }
  }

  // Separate key to count consecutive non-admin confirmations before hiding the link.
  // Requires TWO back-to-back successful API calls returning non-admin before the
  // link is removed — prevents a single transient wrong response from hiding it.
  const ADMIN_STRIKE_KEY = 'rr_nav_admin_strike_v1';

  function readAdminStrike() {
    try { return Number(localStorage.getItem(ADMIN_STRIKE_KEY) || '0') || 0; } catch (_) { return 0; }
  }

  function writeAdminStrike(n) {
    try { localStorage.setItem(ADMIN_STRIKE_KEY, String(n)); } catch (_) {}
  }

  function clearAdminStrike() {
    try { localStorage.removeItem(ADMIN_STRIKE_KEY); } catch (_) {}
  }

  function resolveIsAdmin(user) {
    const role = String((user && user.role) || '').toLowerCase();
    const roles = Array.isArray(user && user.roles)
      ? user.roles.map((r) => String(r || '').toLowerCase())
      : [];
    return !!(
      (user && user.isAdmin === true)
      || (user && user.isInstitutionAdmin === true)
      || role === 'admin'
      || roles.includes('admin')
      || roles.includes('institution_admin')
      || roles.includes('institution-admin')
    );
  }

  async function syncNavPlan() {
    const badge = document.getElementById('planBadge');
    const token = (typeof getStoredToken === 'function' ? getStoredToken() : '')
      || localStorage.getItem('token')
      || sessionStorage.getItem('token')
      || '';

    // ── Phase 1: apply cached state immediately so the link never flickers ──
    const cachedAdmin = readCachedAdminState();
    if (cachedAdmin === true) {
      upsertAdminInvitesLink(true);
    }

    if (!token) {
      // No token — user is logged out. Only hide if cache is definitively non-admin.
      if (cachedAdmin !== true) {
        upsertAdminInvitesLink(false);
      }
      if (badge) badge.textContent = formatPlanLabel('free');
      return;
    }

    // ── Phase 2: fetch fresh state from the API ──────────────────────────────
    try {
      const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
      const res = await fetch(apiBase + '/api/me', {
        headers: { Authorization: 'Bearer ' + token }
      });

      if (!res.ok) {
        // API error — keep cached state (already applied in Phase 1).
        if (badge) badge.textContent = formatPlanLabel('free');
        return;
      }

      const data = await res.json();
      const plan = (data.user && data.user.plan) || 'free';
      const isAdmin = resolveIsAdmin(data && data.user);
      if (badge) badge.textContent = formatPlanLabel(plan);

      if (isAdmin) {
        // Confirmed admin — show link, clear any accumulated strikes.
        upsertAdminInvitesLink(true);
        writeCachedAdminState(true);
        clearAdminStrike();
      } else {
        // API says non-admin. Use a two-strike system to protect against a single
        // transient wrong response wiping out the link for a real admin user.
        if (cachedAdmin === true) {
          // Cache says admin but API disagrees — accumulate a strike.
          const strikes = readAdminStrike() + 1;
          if (strikes >= 2) {
            // Two consecutive non-admin responses — trust the API and remove the link.
            upsertAdminInvitesLink(false);
            writeCachedAdminState(false);
            clearAdminStrike();
          } else {
            // Only one strike so far — keep the link visible, write the strike count.
            writeAdminStrike(strikes);
            // Keep the link showing (it was set in Phase 1 or by previous page load).
          }
        } else {
          // Cache already says non-admin (or unknown) — remove immediately.
          upsertAdminInvitesLink(false);
          writeCachedAdminState(false);
          clearAdminStrike();
        }
      }
    } catch (_) {
      // Network/parse error — cached state already applied in Phase 1, do nothing.
      if (badge) badge.textContent = formatPlanLabel('free');
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
