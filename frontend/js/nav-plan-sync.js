// nav-plan-sync.js — Updates the plan badge in the sidebar nav on any page
// Include this script on all public/marketing pages to keep the plan display accurate.
(function () {
  const ADMIN_CACHE_KEY = 'rr_nav_is_admin_v1';
  const LOCAL_EXP_KEY = 'rr_exp_country_local_v1';
  const EXP_CONTEXT_ENDPOINT = '/api/experience/context';
  const EXP_PREFERENCE_ENDPOINT = '/api/experience/preference';

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

  function normalizeCountryCode(value) {
    const code = String(value || '').trim().toUpperCase();
    if (code === 'GLOBAL' || code === 'JM' || code === 'US') return code;
    return 'GLOBAL';
  }

  function buildPersonalizationContext(context, fallbackCountry) {
    const source = context && typeof context === 'object' ? context : {};
    const country = normalizeCountryCode(source.effectiveCountry || fallbackCountry || readCachedExperienceCountry());
    return {
      effectiveCountry: country,
      showJamaicaHub: source.showJamaicaHub === true,
      requiresChoice: source.requiresChoice === true,
      source: source.source || (source.effectiveCountry ? 'server' : 'fallback'),
      updatedAt: Date.now()
    };
  }

  function publishPersonalizationContext(context) {
    const normalized = buildPersonalizationContext(context, context && context.effectiveCountry);
    window.__rrPersonalization = normalized;
    window.__rrExperienceCountry = normalized.effectiveCountry;
    try {
      document.dispatchEvent(new CustomEvent('rr:personalization-updated', { detail: normalized }));
    } catch (_) {
      // ignore custom event failures
    }
    return normalized;
  }

  function getSidebarContainer() {
    return document.querySelector('#sidebarNav nav, .sidebar nav, .sidebar');
  }

  function readCachedExperienceCountry() {
    try {
      return normalizeCountryCode(localStorage.getItem(LOCAL_EXP_KEY) || '');
    } catch (_) {
      return 'GLOBAL';
    }
  }

  function writeCachedExperienceCountry(countryCode) {
    try {
      localStorage.setItem(LOCAL_EXP_KEY, normalizeCountryCode(countryCode));
    } catch (_) {
      // ignore storage write failures
    }
  }

  function ensureExperienceThemeStyle() {
    if (document.getElementById('rrNavExpThemeStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrNavExpThemeStyle';
    style.textContent = [
      ':root{--rr-exp-primary:#3b82f6;--rr-exp-accent:#06b6d4;--rr-exp-dark:#1e40af;--rr-exp-border:rgba(59,130,246,.35);--rr-exp-bg:rgba(59,130,246,.08);}',
      '.business-bar{border-bottom:1px solid var(--rr-exp-border) !important;box-shadow:0 8px 24px var(--rr-exp-bg) !important;}',
      '.sidebar-link-btn.active{background:linear-gradient(180deg,var(--rr-exp-primary),var(--rr-exp-dark)) !important;border-color:var(--rr-exp-primary) !important;color:#fff !important;}',
      '.sidebar-link-btn:hover{border-color:var(--rr-exp-primary) !important;box-shadow:0 0 0 1px var(--rr-exp-border) inset;}',
      '.sidebar-section-label{color:var(--rr-exp-accent) !important;}',
      '.quickstart-link,.auth-submit-btn,.checkout-btn,.secondary-btn.plan-info-active{border-color:var(--rr-exp-primary) !important;}',
      '.quickstart-link{background:var(--rr-exp-bg) !important;color:var(--rr-exp-primary) !important;}',
      '.secondary-btn.plan-info-active{background:var(--rr-exp-primary) !important;color:#fff !important;}'
    ].join('');
    document.head.appendChild(style);
  }

  function applyExperienceTheme(countryCode) {
    const code = normalizeCountryCode(countryCode);
    const themes = {
      JM: {
        primary: '#007A5E',
        accent: '#FFD700',
        dark: '#000000',
        border: 'rgba(0,122,94,.42)',
        bg: 'rgba(0,122,94,.10)'
      },
      US: {
        primary: '#1D4ED8',
        accent: '#DC2626',
        dark: '#1E3A8A',
        border: 'rgba(29,78,216,.40)',
        bg: 'rgba(29,78,216,.10)'
      },
      GLOBAL: {
        primary: '#3B82F6',
        accent: '#06B6D4',
        dark: '#1E40AF',
        border: 'rgba(59,130,246,.35)',
        bg: 'rgba(59,130,246,.08)'
      }
    };
    const theme = themes[code] || themes.GLOBAL;
    ensureExperienceThemeStyle();
    document.documentElement.style.setProperty('--rr-exp-primary', theme.primary);
    document.documentElement.style.setProperty('--rr-exp-accent', theme.accent);
    document.documentElement.style.setProperty('--rr-exp-dark', theme.dark);
    document.documentElement.style.setProperty('--rr-exp-border', theme.border);
    document.documentElement.style.setProperty('--rr-exp-bg', theme.bg);
    document.documentElement.setAttribute('data-exp-country', code);
  }

  function ensureExperiencePromptStyle() {
    if (document.getElementById('rrNavExpPromptStyle')) return;
    const style = document.createElement('style');
    style.id = 'rrNavExpPromptStyle';
    style.textContent = [
      '.rr-exp-gate-overlay{position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.82);display:grid;place-items:center;padding:16px;backdrop-filter:blur(4px);}',
      '.rr-exp-gate-card{width:min(460px,100%);background:linear-gradient(180deg,#0f172a,#111827);border:2px solid var(--rr-exp-primary);border-radius:14px;padding:20px;color:#e2e8f0;box-shadow:0 24px 60px rgba(2,6,23,.85);}',
      '.rr-exp-gate-card h3{margin:0 0 8px;color:#f8fafc;font-size:1.2rem;}',
      '.rr-exp-gate-card p{margin:0 0 14px;color:#cbd5e1;line-height:1.5;}',
      '.rr-exp-gate-card select{width:100%;margin-bottom:12px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:10px;}',
      '.rr-exp-gate-card button{width:100%;border:1px solid var(--rr-exp-primary);background:linear-gradient(180deg,var(--rr-exp-primary),var(--rr-exp-dark));color:#fff;border-radius:8px;padding:10px 12px;font-weight:800;cursor:pointer;}'
    ].join('');
    document.head.appendChild(style);
  }

  async function saveExperiencePreference(countryCode, token) {
    const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(apiBase + EXP_PREFERENCE_ENDPOINT, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ countryCode: normalizeCountryCode(countryCode) })
    });
    if (!res.ok) {
      let msg = 'Could not save experience.';
      try {
        const data = await res.json();
        msg = data && data.error ? data.error : msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  function showHomepageExperienceGate(context, token) {
    const currentPage = normalizePath(window.location.href) || 'index.html';
    if (currentPage !== 'index.html') return;
    if (!context || context.requiresChoice !== true) return;
    if (!token) return;
    if (document.getElementById('rrExpGateOverlay')) return;

    ensureExperiencePromptStyle();

    const overlay = document.createElement('div');
    overlay.id = 'rrExpGateOverlay';
    overlay.className = 'rr-exp-gate-overlay';

    const card = document.createElement('div');
    card.className = 'rr-exp-gate-card';

    const title = document.createElement('h3');
    title.textContent = 'Choose your country experience';

    const copy = document.createElement('p');
    copy.textContent = 'Select your market so all tabs, search, and recommendations match your experience.';

    const select = document.createElement('select');
    const countries = Array.isArray(context.supportedCountries) ? context.supportedCountries : [
      { code: 'GLOBAL', label: 'Global' },
      { code: 'JM', label: 'Jamaica' },
      { code: 'US', label: 'United States' }
    ];
    countries.forEach((country) => {
      const option = document.createElement('option');
      option.value = normalizeCountryCode(country.code);
      option.textContent = country.label;
      select.appendChild(option);
    });
    select.value = normalizeCountryCode(context.effectiveCountry || context.detectedCountry || 'GLOBAL');

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue';

    let submitting = false;
    const stopEscape = function (event) {
      if (event.key === 'Escape' && document.getElementById('rrExpGateOverlay')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const stopPopState = function (event) {
      if (!document.getElementById('rrExpGateOverlay')) return;
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };
    const stopUnload = function (event) {
      if (!document.getElementById('rrExpGateOverlay') || submitting) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    document.addEventListener('keydown', stopEscape, true);
    window.addEventListener('popstate', stopPopState);
    window.addEventListener('beforeunload', stopUnload);
    window.history.pushState(null, '', window.location.href);

    button.addEventListener('click', async function () {
      if (submitting) return;
      const selected = normalizeCountryCode(select.value || 'GLOBAL');
      submitting = true;
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        const saved = await saveExperiencePreference(selected, token);
        const effective = normalizeCountryCode((saved && saved.effectiveCountry) || selected);
        writeCachedExperienceCountry(effective);
        applyExperienceTheme(effective);
        const personalization = publishPersonalizationContext(Object.assign({}, saved || {}, {
          effectiveCountry: effective,
          showJamaicaHub: saved && saved.showJamaicaHub === true
        }));
        applyJamaicaHubVisibility(personalization.showJamaicaHub);
        overlay.remove();
        document.removeEventListener('keydown', stopEscape, true);
        window.removeEventListener('popstate', stopPopState);
        window.removeEventListener('beforeunload', stopUnload);
      } catch (error) {
        submitting = false;
        button.disabled = false;
        button.textContent = error && error.message ? error.message : 'Try again';
      }
    });

    card.appendChild(title);
    card.appendChild(copy);
    card.appendChild(select);
    card.appendChild(button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
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
    const nav = getSidebarContainer();
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
      'faq.html',
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

  function applyJamaicaHubVisibility(show) {
    // Handle both sidebar structures: with nav element and direct sidebar
    let sidebarElements = [];
    
    // Try to find sidebar with nav element
    const navContainer = document.querySelector('#sidebarNav nav, .sidebar nav');
    if (navContainer) {
      sidebarElements = [navContainer];
    }
    
    // Also check direct sidebar (no nav wrapper)
    const directSidebar = document.querySelector('.sidebar');
    if (directSidebar && directSidebar !== navContainer?.parentElement) {
      sidebarElements.push(directSidebar);
    }
    
    if (!sidebarElements.length) return;
    
    const display = show ? '' : 'none';
    
    sidebarElements.forEach((container) => {
      // Hide/show Jamaica label
      const jamaicaLabel = container.querySelector('.sidebar-section-label[data-section="jamaica"]');
      if (jamaicaLabel) jamaicaLabel.style.display = display;
      
      // Hide/show Jamaica link
      const jamaicaLink = Array.from(container.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => {
          const href = String(l.getAttribute('href') || '');
          return href.includes('jamaica-workforce-accelerator');
        });
      if (jamaicaLink) jamaicaLink.style.display = display;
      
      // Hide/show Cohort Manager link
      const cohortLink = Array.from(container.querySelectorAll('a.sidebar-link-btn'))
        .find((l) => {
          const href = String(l.getAttribute('href') || '');
          return href.includes('institution-cohort-manager');
        });
      if (cohortLink) cohortLink.style.display = display;
    });
  }

  async function syncJamaicaHubVisibility(token) {
    try {
      const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
      const headers = { Accept: 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(apiBase + '/api/experience/context', { headers, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const personalization = publishPersonalizationContext(data || {});
      applyJamaicaHubVisibility(personalization.showJamaicaHub);
    } catch (_) {
      // On error, leave Jamaica hub in its current state
    }
  }

  async function syncExperienceThemeAndGate(token) {
    const apiBase = (typeof getApiBase === 'function') ? getApiBase() : '';
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;

    try {
      const res = await fetch(apiBase + EXP_CONTEXT_ENDPOINT, { headers, credentials: 'include' });
      if (!res.ok) return;
      const context = await res.json();
      const country = normalizeCountryCode((context && context.effectiveCountry) || readCachedExperienceCountry());
      writeCachedExperienceCountry(country);
      const personalization = publishPersonalizationContext(Object.assign({}, context || {}, {
        effectiveCountry: country,
        showJamaicaHub: context && context.showJamaicaHub === true
      }));
      applyExperienceTheme(country);
      applyJamaicaHubVisibility(personalization.showJamaicaHub);

      const currentPage = normalizePath(window.location.href) || 'index.html';
      const noAuthPages = new Set([
        'login.html',
        'signup.html',
        'forgot-password.html',
        'reset-password.html',
        'verify-email.html'
      ]);
      var shouldRouteToHomeForChoice = !!token
        && !!(context && context.requiresChoice === true)
        && currentPage !== 'index.html'
        && !noAuthPages.has(currentPage);

      if (shouldRouteToHomeForChoice) {
        const target = 'index.html?experienceRequired=1&returnTo=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        window.location.replace(target);
        return;
      }

      showHomepageExperienceGate(context, token);
    } catch (_) {
      const fallback = publishPersonalizationContext({
        effectiveCountry: readCachedExperienceCountry(),
        showJamaicaHub: false,
        requiresChoice: false,
        source: 'fallback'
      });
      applyExperienceTheme(fallback.effectiveCountry);
      applyJamaicaHubVisibility(fallback.showJamaicaHub);
    }
  }

  function upsertAdminInvitesLink(isAdmin) {
    const nav = getSidebarContainer();
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
    const accountType = String((user && user.accountType) || '').toLowerCase();
    const roles = Array.isArray(user && user.roles)
      ? user.roles.map((r) => String(r || '').toLowerCase())
      : [];
    return !!(
      (user && user.isAdmin === true)
      || (user && user.isInstitutionAdmin === true)
      || accountType === 'institution'
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
      // Keep experience state aligned to server/cookie context even without a token.
      syncJamaicaHubVisibility('');
      syncExperienceThemeAndGate('');
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
        // Fall back to anonymous context so stale local cache does not keep
        // Jamaica-only links visible for non-JM users.
        syncJamaicaHubVisibility('');
        syncExperienceThemeAndGate('');
        return;
      }

      const data = await res.json();
      const plan = (data.user && data.user.plan) || 'free';
      const isAdmin = resolveIsAdmin(data && data.user);
      if (badge) badge.textContent = formatPlanLabel(plan);

      // Sync Jamaica Hub visibility and experience theme/prompt based on context
      syncJamaicaHubVisibility(token);
      syncExperienceThemeAndGate(token);

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
      applyExperienceTheme(readCachedExperienceCountry());
      applyJamaicaHubVisibility(false);
    }
  }

  function bootstrapNav() {
    decorateSidebarNav();
    const fallback = publishPersonalizationContext({
      effectiveCountry: readCachedExperienceCountry(),
      showJamaicaHub: false,
      requiresChoice: false,
      source: 'bootstrap'
    });
    applyExperienceTheme(fallback.effectiveCountry);
    // Hide by default; only server-confirmed context should re-enable Jamaica hub.
    applyJamaicaHubVisibility(fallback.showJamaicaHub);
    syncNavPlan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapNav);
  } else {
    bootstrapNav();
  }
})();
