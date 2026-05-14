(function () {
  var CONTEXT_ENDPOINT = '/api/experience/context';
  var PREFERENCE_ENDPOINT = '/api/experience/preference';
  var LOCAL_STORAGE_KEY = 'rr_exp_country_local_v1';
  var TELEMETRY_ENDPOINT = '/api/telemetry';
  var reportedMismatchKeys = {};

  function normalizeCountryCode(value) {
    var code = String(value || '').trim().toUpperCase();
    if (code === 'GLOBAL' || code === 'JM' || code === 'US') return code;
    return 'GLOBAL';
  }

  function isJamaicaExperiencePage() {
    var page = String(window.location.pathname || '').split('/').pop().toLowerCase();
    return page === 'jamaica-workforce-accelerator.html' || page === 'nav-flow-mock-jamaica.html';
  }

  function resolveThemeCountry(countryCode) {
    // If on Jamaica page, force Jamaica theme
    if (isJamaicaExperiencePage()) return 'JM';
    
    return normalizeCountryCode(countryCode);
  }

  function getAuthTokenForTelemetry() {
    try {
      if (typeof getToken === 'function') {
        var token = getToken();
        if (token) return token;
      }
    } catch (_) {}
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    } catch (_) {
      return '';
    }
  }

  function reportExperienceMismatch(type, details) {
    var safeDetails = details && typeof details === 'object' ? details : {};
    var dedupeKey = [
      type,
      String(safeDetails.country || ''),
      String(safeDetails.source || ''),
      String(safeDetails.rawShowJamaicaHub || ''),
      String(window.location.pathname || '')
    ].join('|');

    if (reportedMismatchKeys[dedupeKey]) return;
    reportedMismatchKeys[dedupeKey] = true;

    var payload = {
      event: 'experience_personalization_mismatch',
      funnel: 'experience_consistency',
      page: String(window.location.pathname || '').slice(0, 120),
      variant: 'experience-country',
      meta: Object.assign({ type: type }, safeDetails)
    };

    var headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    var token = getAuthTokenForTelemetry();
    if (token) headers.Authorization = 'Bearer ' + token;

    fetch(typeof apiUrl === 'function' ? apiUrl(TELEMETRY_ENDPOINT) : TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function applyExperienceThemeClass(countryCode) {
    var normalized = resolveThemeCountry(countryCode);
    var root = document.documentElement;
    var body = document.body;
    var classes = ['rr-theme-us', 'rr-theme-jm', 'rr-theme-global'];

    classes.forEach(function (name) {
      if (root) root.classList.remove(name);
      if (body) body.classList.remove(name);
    });

    var nextClass = normalized === 'US' ? 'rr-theme-us' : (normalized === 'JM' ? 'rr-theme-jm' : 'rr-theme-global');
    if (root) root.classList.add(nextClass);
    if (body) body.classList.add(nextClass);
  }

  function readPublishedPersonalization() {
    var ctx = window.__rrPersonalization;
    if (!ctx || typeof ctx !== 'object') return null;
    return {
      effectiveCountry: normalizeCountryCode(ctx.effectiveCountry),
      showJamaicaHub: ctx.showJamaicaHub === true,
      requiresChoice: ctx.requiresChoice === true,
      source: String(ctx.source || '')
    };
  }

  function publishPersonalizationContext(context) {
    var normalizedCountry = resolveThemeCountry(context && context.effectiveCountry);
    var rawShowJamaicaHub = !!(context && context.showJamaicaHub === true);
    if (rawShowJamaicaHub && normalizedCountry !== 'JM') {
      reportExperienceMismatch('show_jamaica_outside_jm', {
        country: normalizedCountry,
        source: String((context && context.source) || 'client'),
        rawShowJamaicaHub: true
      });
    }
    var normalized = {
      effectiveCountry: normalizedCountry,
      showJamaicaHub: normalizedCountry === 'JM',
      requiresChoice: !!(context && context.requiresChoice === true),
      source: String((context && context.source) || 'client'),
      updatedAt: Date.now()
    };
    window.__rrPersonalization = normalized;
    window.__rrExperienceCountry = normalized.effectiveCountry;
    applyExperienceThemeClass(normalized.effectiveCountry);
    try {
      document.dispatchEvent(new CustomEvent('rr:personalization-updated', { detail: normalized }));
    } catch (_) {}
    return normalized;
  }

  function getAuthHeader() {
    try {
      if (typeof getToken === 'function') {
        var token = getToken();
        if (token) return { Authorization: 'Bearer ' + token };
      }
    } catch (_) {}
    try {
      var fallbackToken = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      if (fallbackToken) return { Authorization: 'Bearer ' + fallbackToken };
    } catch (_) {}
    return {};
  }

  function getSavedLocalCountry() {
    try {
      return (localStorage.getItem(LOCAL_STORAGE_KEY) || '').toUpperCase();
    } catch (_) {
      return '';
    }
  }

  function setSavedLocalCountry(countryCode) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(countryCode || '').toUpperCase());
    } catch (_) {}
  }

  function defaultContext() {
    var published = readPublishedPersonalization();
    var fallbackCountry = published ? published.effectiveCountry : (getSavedLocalCountry() || 'GLOBAL');
    return {
      detectedCountry: 'GLOBAL',
      selectedCountry: getSavedLocalCountry() || '',
      effectiveCountry: fallbackCountry,
      source: 'system',
      requiresChoice: published ? published.requiresChoice : false,
      // Server response should be the only source of truth for Jamaica hub.
      showJamaicaHub: published ? published.showJamaicaHub : false,
      experienceVariant: fallbackCountry === 'JM' ? 'jamaica' : 'global',
      supportedCountries: [
        { code: 'GLOBAL', label: 'Global' },
        { code: 'JM', label: 'Jamaica' },
        { code: 'US', label: 'United States' }
      ]
    };
  }

  async function fetchExperienceContext() {
    var headers = Object.assign({ Accept: 'application/json' }, getAuthHeader());
    try {
      var response = await fetch(typeof apiUrl === 'function' ? apiUrl(CONTEXT_ENDPOINT) : CONTEXT_ENDPOINT, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });
      if (!response.ok) return defaultContext();
      var data = await response.json();
      
      // IMPORTANT: Only update localStorage if user hasn't set an explicit preference
      // User preference is immutable once set - don't override with API context
      var userPreference = getSavedLocalCountry();
      if (!userPreference) {
        // User has NO preference; OK to use server context
        if (data && data.effectiveCountry) {
          setSavedLocalCountry(data.effectiveCountry);
        }
      }
      // If user HAS set a preference (US, JM, GLOBAL, etc.), DO NOT override it with server response
      
      var merged = Object.assign(defaultContext(), data || {});
      // CRITICAL FIX: Don't allow API effectiveCountry to override user preference
      // If user has an explicit localStorage preference, preserve it in the merged object
      if (userPreference) {
        merged.effectiveCountry = userPreference;
      }
      publishPersonalizationContext(merged);
      return merged;
    } catch (_) {
      return defaultContext();
    }
  }

  async function savePreference(countryCode) {
    var headers = Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, getAuthHeader());
    var response = await fetch(typeof apiUrl === 'function' ? apiUrl(PREFERENCE_ENDPOINT) : PREFERENCE_ENDPOINT, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ countryCode: countryCode })
    });

    if (!response.ok) {
      var errData = {};
      try { errData = await response.json(); } catch (_) {}
      throw new Error(errData.error || 'Could not save preference');
    }

    var data = await response.json();
    if (data && data.effectiveCountry) {
      setSavedLocalCountry(data.effectiveCountry);
    }
    publishPersonalizationContext(data || {});
    return data;
  }

  function hideJamaicaElements(showJamaicaHub) {
    var jamaicaLinks = document.querySelectorAll('a[href="jamaica-workforce-accelerator.html"], a[href$="/jamaica-workforce-accelerator.html"]');
    var jamaicaSectionLabels = document.querySelectorAll('[data-section="jamaica"]');
    var shouldShow = !!showJamaicaHub;

    jamaicaLinks.forEach(function (link) {
      link.style.display = shouldShow ? '' : 'none';
    });
    jamaicaSectionLabels.forEach(function (label) {
      label.style.display = shouldShow ? '' : 'none';
    });
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && typeof value === 'string') el.textContent = value;
  }

  function setHref(id, value) {
    var el = document.getElementById(id);
    if (el && typeof value === 'string') el.setAttribute('href', value);
  }

  function setByClassValue(container, className, value) {
    if (!container || typeof value !== 'string') return;
    var target = container.querySelector('.' + className);
    if (target) target.textContent = value;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function applyJobMatches(countryCode) {
    var list = document.getElementById('rrShotJobMatches');
    if (!list) return;

    var renderMatchRow = function (job) {
      var href = (job.href || '').trim();
      return [
        '<a class="rr-shot-row rr-shot-row-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">',
        '  <div>',
        '    <div class="title">' + escapeHtml(job.title) + '</div>',
        '    <div class="meta">' + escapeHtml(job.meta) + '</div>',
        '  </div>',
        '  <span class="rr-shot-apply">Open job</span>',
        '</a>'
      ].join('');
    };

    var jobsByCountry = {
      JM: [
        {
          title: 'Customer Service Representative',
          meta: 'Kingston, Jamaica · BPO / Customer Success',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Customer%20Service%20Representative&location=Jamaica'
        },
        {
          title: 'Administrative Assistant',
          meta: 'Montego Bay, Jamaica · Operations',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Administrative%20Assistant&location=Jamaica'
        },
        {
          title: 'Project Coordinator',
          meta: 'Portmore, Jamaica · Project Operations',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Project%20Coordinator&location=Jamaica'
        }
      ],
      US: [
        {
          title: 'Product Manager',
          meta: 'United States · Product',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Product%20Manager&location=United%20States'
        },
        {
          title: 'AI/ML Engineer',
          meta: 'United States · Engineering',
          href: 'https://www.linkedin.com/jobs/search/?keywords=AI%2FML%20Engineer&location=United%20States'
        },
        {
          title: 'Software Engineer',
          meta: 'United States · Engineering',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer&location=United%20States'
        }
      ],
      GLOBAL: [
        {
          title: 'Customer Success Manager',
          meta: 'Remote · Global Market',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Customer%20Success%20Manager&location=Remote'
        },
        {
          title: 'Data Analyst',
          meta: 'Hybrid · International Opportunities',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Data%20Analyst&location=Remote'
        },
        {
          title: 'Project Manager',
          meta: 'Remote · Cross-Region Roles',
          href: 'https://www.linkedin.com/jobs/search/?keywords=Project%20Manager&location=Remote'
        }
      ]
    };

    var jobs = jobsByCountry[countryCode] || jobsByCountry.GLOBAL;
    list.innerHTML = jobs.map(renderMatchRow).join('');
  }

  function applyToolCards(countryCode) {
    var toolsWrap = document.getElementById('rrShotTools');
    if (!toolsWrap) return;

    var cards = toolsWrap.querySelectorAll('.rr-shot-tool');
    if (!cards || cards.length < 4) return;

    var cardConfigs = {
      JM: [
        { href: 'jamaica-workforce-accelerator.html', title: '🇯🇲 Jamaica Workforce Accelerator', sub: 'Explore Jamaica job trends, market radar, and local opportunity pathways.' },
        { href: 'job-alerts-sms.html', title: '📱 Jamaica Job Alerts', sub: 'Get SMS and WhatsApp alerts for Kingston, Montego Bay, Portmore, and more.' },
        { href: 'interview-prep-ai.html', title: '🎤 Interview Prep', sub: 'Practice smart questions and answers for Jamaican and Caribbean job roles.' },
        { href: 'resume-generator.html', title: '📄 Resume Generator', sub: 'Build an ATS-ready resume tailored for Jamaican employers and regional roles.' }
      ],
      US: [
        { href: 'job-search.html?source=market&region=us', title: '🇺🇸 US Opportunity Finder', sub: 'Track in-demand US roles, salary bands, and remote-friendly openings.' },
        { href: 'job-alerts-sms.html', title: '📲 US Job Alerts', sub: 'Receive role alerts tuned for major US hiring hubs and remote-first teams.' },
        { href: 'interview-prep-ai.html', title: '🧠 US Interview Simulator', sub: 'Practice behavioral and technical interviews in the US hiring style.' },
        { href: 'resume-generator.html', title: '📄 US Resume Builder', sub: 'Generate concise US-format resumes with measurable impact bullets.' }
      ],
      GLOBAL: [
        { href: 'job-search.html?source=market', title: '🌍 Global Opportunity Scanner', sub: 'Search opportunities across regions and industries with one workflow.' },
        { href: 'job-alerts-sms.html', title: '📲 Global Job Alerts', sub: 'Get role alerts tuned to your skills and preferred locations.' },
        { href: 'interview-prep-ai.html', title: '🎤 Interview Prep AI', sub: 'Prepare for modern interviews with role-specific practice questions.' },
        { href: 'resume-generator.html', title: '📄 Resume Generator', sub: 'Create ATS-optimized resumes tailored to your target role and market.' }
      ]
    };

    var selected = cardConfigs[countryCode] || cardConfigs.GLOBAL;

    for (var i = 0; i < 4; i += 1) {
      var card = cards[i];
      var config = selected[i];
      if (!card || !config) continue;
      card.setAttribute('href', config.href);
      setByClassValue(card, 'rr-shot-tool-title', config.title);
      setByClassValue(card, 'rr-shot-tool-sub', config.sub);
    }
  }

  function applyDashboardVariant(countryCode) {
    var isDashboard = window.location.pathname.indexOf('dashboard.html') !== -1 || window.location.pathname === '/dashboard';
    if (!isDashboard) return;

    var variants = {
      JM: {
        badge: '🇯🇲 Jamaica Workforce Accelerator Mode',
        lead: "Here's your Jamaica-focused career progress today.",
        panelTitle: 'Top Job Matches for Jamaica',
        panelLink: 'job-search.html?source=market&region=jm',
        matchLabel: 'Jamaica Match Score',
        profileLabel: 'Profile Strength'
      },
      US: {
        badge: '🇺🇸 United States Experience',
        lead: "Here's your US-market career progress today.",
        panelTitle: 'Top Job Matches for the United States',
        panelLink: 'job-search.html?source=market&region=us',
        matchLabel: 'US Match Score',
        profileLabel: 'Profile Strength'
      },
      GLOBAL: {
        badge: '🌍 Global Experience',
        lead: "Here's your global career progress today.",
        panelTitle: 'Top Job Matches for You',
        panelLink: 'job-search.html?source=market',
        matchLabel: 'Job Match Score',
        profileLabel: 'Profile Strength'
      }
    };

    var selected = variants[countryCode] || variants.GLOBAL;
    window.__rrExperienceCountry = countryCode;

    setText('rrShotLead', selected.lead);
    setText('rrShotPanelTitle', selected.panelTitle);
    setHref('rrShotPanelLink', selected.panelLink);
    setText('rrShotMatchLabel', selected.matchLabel);
    setText('rrShotProfileLabel', selected.profileLabel);

    var badge = document.getElementById('rrShotBadge');
    if (badge) {
      badge.textContent = '';
      badge.style.display = 'none';
    }

    applyToolCards(countryCode);
  }

  function applyCountryTheme(countryCode) {
    var normalizedCountryCode = resolveThemeCountry(countryCode);
    var themes = {
      JM: {
        primary: '#009B3A',
        accent: '#FED100',
        dark: '#000000',
        border: 'rgba(0, 155, 58, 0.4)',
        bg: 'rgba(0, 155, 58, 0.08)',
        label: '🇯🇲'
      },
      US: {
        primary: '#002868',
        accent: '#BF0A30',
        dark: '#001F4D',
        border: 'rgba(255, 255, 255, 0.68)',
        bg: 'rgba(191, 10, 48, 0.12)',
        label: '🇺🇸'
      },
      GLOBAL: {
        primary: '#3B82F6',
        accent: '#06B6D4',
        dark: '#1E3A8A',
        border: 'rgba(59, 130, 246, 0.4)',
        bg: 'rgba(59, 130, 246, 0.08)',
        label: '🌍'
      }
    };

    var theme = themes[normalizedCountryCode] || themes.GLOBAL;
    document.documentElement.style.setProperty('--rr-exp-primary', theme.primary);
    document.documentElement.style.setProperty('--rr-exp-accent', theme.accent);
    document.documentElement.style.setProperty('--rr-exp-dark', theme.dark);
    document.documentElement.style.setProperty('--rr-exp-border', theme.border);
    document.documentElement.style.setProperty('--rr-exp-bg', theme.bg);
    document.documentElement.style.setProperty('--rr-exp-label', '"' + theme.label + '"');

    // Apply theme to buttons and accents
    var buttons = document.querySelectorAll('.rr-shot-btn, .checkout-btn, .auth-submit-btn');
    buttons.forEach(function (btn) {
      if (!btn.getAttribute('data-original-bg')) {
        btn.setAttribute('data-original-bg', btn.style.background);
      }
      btn.style.borderColor = theme.primary;
      btn.style.background = 'linear-gradient(180deg, ' + theme.primary + ' 0%, ' + theme.dark + ' 100%)';
    });
  }

  function createHeaderExperienceSelector(context) {
    var isDashboard = window.location.pathname.indexOf('dashboard.html') !== -1 || window.location.pathname === '/dashboard';
    if (isDashboard) return;
    if (document.getElementById('rrExpHeaderSelector')) return;

    var header = document.querySelector('.rr-shot-header');
    if (!header) return;

    var selector = document.createElement('div');
    selector.id = 'rrExpHeaderSelector';
    selector.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap;';

    var label = document.createElement('span');
    label.style.cssText = 'color:#9fb3cf;font-weight:700;font-size:.75rem;letter-spacing:.05em;text-transform:uppercase;margin-right:4px;';
    label.textContent = 'Experience:';

    (context.supportedCountries || []).forEach(function (country) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rr-exp-header-btn';
      btn.setAttribute('data-country', country.code);
      btn.textContent = country.label;
      btn.style.cssText = [
        'padding:6px 12px;',
        'border-radius:999px;',
        'border:1px solid;',
        'font-weight:700;',
        'font-size:.8rem;',
        'cursor:pointer;',
        'transition:all 200ms ease;',
        country.code === context.effectiveCountry ?
          'background:var(--rr-exp-primary);color:#fff;border-color:var(--rr-exp-primary);' :
          'background:transparent;color:#9fb3cf;border-color:rgba(59,130,246,.3);'
      ].join('');

      btn.addEventListener('click', async function () {
        var selected = country.code.toUpperCase();
        btn.disabled = true;
        var originalText = btn.textContent;
        btn.textContent = 'Saving...';
        try {
          var saved = await savePreference(selected);
          var savedCountry = normalizeCountryCode((saved && saved.effectiveCountry) || selected);
          var savedContext = publishPersonalizationContext({
            effectiveCountry: savedCountry,
            showJamaicaHub: savedCountry === 'JM' || (saved && saved.showJamaicaHub === true),
            requiresChoice: false,
            source: 'user'
          });
          hideJamaicaElements(savedContext.showJamaicaHub);
          applyDashboardVariant(savedContext.effectiveCountry);
          applyCountryTheme(savedContext.effectiveCountry);
          updateHeaderButtonStates(savedContext.effectiveCountry);
        } catch (_) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });

      selector.appendChild(btn);
    });

    selector.insertBefore(label, selector.firstChild);
    header.insertBefore(selector, header.firstChild);

    updateHeaderButtonStates(context.effectiveCountry || 'GLOBAL');
  }

  function updateHeaderButtonStates(activeCountry) {
    var buttons = document.querySelectorAll('.rr-exp-header-btn');
    buttons.forEach(function (btn) {
      var isActive = btn.getAttribute('data-country') === activeCountry;
      btn.style.background = isActive ? 'var(--rr-exp-primary)' : 'transparent';
      btn.style.color = isActive ? '#fff' : '#9fb3cf';
      btn.style.borderColor = isActive ? 'var(--rr-exp-primary)' : 'rgba(59,130,246,.3)';
      btn.disabled = false;
    });
  }

  function ensureStyle() {
    if (document.getElementById('rrExpCountryStyle')) return;
    var style = document.createElement('style');
    style.id = 'rrExpCountryStyle';
    style.textContent = [
      ':root{--rr-exp-primary:#f97316;--rr-exp-accent:#0ea5e9;--rr-exp-dark:#7c2d12;--rr-exp-border:rgba(249,115,22,0.4);--rr-exp-bg:rgba(249,115,22,0.12);--rr-exp-label:"🌍";}',
      '.rr-exp-country-wrap{margin:10px 0 14px;padding:10px;border-radius:10px;background:var(--rr-exp-bg);border:1px solid var(--rr-exp-border);}',
      '.rr-exp-country-wrap label{display:block;color:#a5b4fc;font-weight:700;font-size:.77rem;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;}',
      '.rr-exp-country-row{display:flex;gap:8px;align-items:center;}',
      '.rr-exp-country-row select{flex:1;min-width:0;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px;}',
      '.rr-exp-country-row button{border:1px solid var(--rr-exp-primary);background:var(--rr-exp-primary);color:#fff;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer;}',
      '.rr-exp-overlay{position:fixed;inset:0;background:rgba(2,6,23,.85);display:grid;place-items:center;z-index:99999;padding:16px;backdrop-filter:blur(4px);}',
      '.rr-exp-overlay *{pointer-events:auto;}',
      '.rr-exp-card{width:min(460px,100%);background:linear-gradient(180deg,#0f172a 0%,#111827 100%);border:2px solid var(--rr-exp-primary);border-radius:14px;padding:20px;color:#e2e8f0;box-shadow:0 20px 50px rgba(2,6,23,.85);position:relative;z-index:100000;}',
      '.rr-exp-card h3{margin:0 0 8px;font-size:1.2rem;color:#f8fafc;}',
      '.rr-exp-card p{margin:0 0 14px;color:#cbd5e1;line-height:1.5;}',
      '.rr-exp-card select{width:100%;margin-bottom:12px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:10px;}',
      '.rr-exp-card button{width:100%;border:1px solid var(--rr-exp-primary);background:linear-gradient(180deg,var(--rr-exp-primary) 0%,var(--rr-exp-dark) 100%);color:#fff;border-radius:8px;padding:10px 12px;font-weight:800;cursor:pointer;transition:all 200ms ease;}'
    ].join('');
    document.head.appendChild(style);
  }

  function insertSidebarSwitcher(context) {
    var isDashboard = window.location.pathname.indexOf('dashboard.html') !== -1 || window.location.pathname === '/dashboard';
    if (isDashboard) return;

    var nav = document.querySelector('.sidebar nav');
    if (!nav || document.getElementById('rrExpCountryWrap')) return;

    var accountLabel = nav.querySelector('[data-section="account"]');
    var container = document.createElement('div');
    container.id = 'rrExpCountryWrap';
    container.className = 'rr-exp-country-wrap';

    var label = document.createElement('label');
    label.setAttribute('for', 'rrExpCountrySelect');
    label.textContent = 'Country Experience';

    var row = document.createElement('div');
    row.className = 'rr-exp-country-row';

    var select = document.createElement('select');
    select.id = 'rrExpCountrySelect';
    (context.supportedCountries || []).forEach(function (country) {
      var opt = document.createElement('option');
      opt.value = country.code;
      opt.textContent = country.label;
      select.appendChild(opt);
    });
    select.value = context.effectiveCountry || 'GLOBAL';

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Save';

    var status = document.createElement('div');
    status.style.cssText = 'margin-top:8px;font-size:.8rem;color:#93c5fd;min-height:16px;';

    button.addEventListener('click', async function () {
      var selected = (select.value || 'GLOBAL').toUpperCase();
      button.disabled = true;
      status.textContent = 'Saving...';
      try {
        var saved = await savePreference(selected);
        var savedCountry = normalizeCountryCode((saved && saved.effectiveCountry) || selected);
        var savedContext = publishPersonalizationContext({
          effectiveCountry: savedCountry,
          showJamaicaHub: savedCountry === 'JM' || (saved && saved.showJamaicaHub === true),
          requiresChoice: false,
          source: 'user'
        });
        hideJamaicaElements(savedContext.showJamaicaHub);
        applyDashboardVariant(savedContext.effectiveCountry);
        applyCountryTheme(savedContext.effectiveCountry);
        updateHeaderButtonStates(savedContext.effectiveCountry);
        status.textContent = 'Saved';

        if (selected !== 'JM' && window.location.pathname.indexOf('jamaica-workforce-accelerator.html') !== -1) {
          window.location.href = 'dashboard.html?experience=global';
        }
      } catch (error) {
        status.textContent = error && error.message ? error.message : 'Save failed';
      } finally {
        button.disabled = false;
      }
    });

    row.appendChild(select);
    row.appendChild(button);
    container.appendChild(label);
    container.appendChild(row);
    container.appendChild(status);

    if (accountLabel) {
      nav.insertBefore(container, accountLabel);
    } else {
      nav.appendChild(container);
    }
  }

  function showFirstVisitPickerIfNeeded(context) {
    var isDashboard = window.location.pathname.indexOf('dashboard.html') !== -1 || window.location.pathname === '/dashboard';
    if (!isDashboard || !context.requiresChoice || document.getElementById('rrExpOverlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'rrExpOverlay';
    overlay.className = 'rr-exp-overlay';
    // Mandatory modal: prevent closing by clicking outside
    overlay.style.pointerEvents = 'none';

    var card = document.createElement('div');
    card.className = 'rr-exp-card';
    card.style.pointerEvents = 'auto';

    var heading = document.createElement('h3');
    heading.textContent = 'Choose your country experience';

    var copy = document.createElement('p');
    copy.textContent = 'We detected ' + (context.detectedCountry || 'GLOBAL') + '. Confirm or switch so your dashboard and hubs match your market.';

    var select = document.createElement('select');
    (context.supportedCountries || []).forEach(function (country) {
      var opt = document.createElement('option');
      opt.value = country.code;
      opt.textContent = country.label;
      select.appendChild(opt);
    });
    select.value = context.effectiveCountry || 'GLOBAL';

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue';

    var isSubmitting = false;

    button.addEventListener('click', async function () {
      if (isSubmitting) return;
      var selected = (select.value || 'GLOBAL').toUpperCase();
      button.disabled = true;
      button.textContent = 'Saving...';
      isSubmitting = true;
      try {
        var saved = await savePreference(selected);
        var savedCountry = normalizeCountryCode((saved && saved.effectiveCountry) || selected);
        var savedContext = publishPersonalizationContext({
          effectiveCountry: savedCountry,
          showJamaicaHub: savedCountry === 'JM' || (saved && saved.showJamaicaHub === true),
          requiresChoice: false,
          source: 'user'
        });
        hideJamaicaElements(savedContext.showJamaicaHub);
        applyDashboardVariant(savedContext.effectiveCountry);
        applyCountryTheme(savedContext.effectiveCountry);
        // Recreate header selector with new context
        var newContext = Object.assign({}, context, { effectiveCountry: savedContext.effectiveCountry, showJamaicaHub: savedContext.showJamaicaHub });
        createHeaderExperienceSelector(newContext);
        overlay.remove();
        // Clean up event listeners once modal is closed
        document.removeEventListener('keydown', handleEscape, true);
        window.removeEventListener('popstate', preventNavigation);
      } catch (_) {
        isSubmitting = false;
        button.disabled = false;
        button.textContent = 'Continue';
      }
    });

    card.appendChild(heading);
    card.appendChild(copy);
    card.appendChild(select);
    card.appendChild(button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Prevent bypassing with Escape key
    var handleEscape = function (e) {
      if (e.key === 'Escape' && document.getElementById('rrExpOverlay')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener('keydown', handleEscape, true);

    // Prevent browser back button during experience selection
    var preventNavigation = function (e) {
      if (document.getElementById('rrExpOverlay')) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', preventNavigation);
    window.history.pushState(null, '', window.location.href);

    // Prevent accidental clicks outside the modal from closing it
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Prevent page unload before choice is made
    var preventUnload = function (e) {
      if (document.getElementById('rrExpOverlay') && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', preventUnload);
  }

  async function init() {
    ensureStyle();
    var context = await fetchExperienceContext();

    var effectiveCountry = context.effectiveCountry || 'GLOBAL';
    if (context.showJamaicaHub === true && effectiveCountry !== 'JM') {
      reportExperienceMismatch('server_context_hub_country_conflict', {
        country: effectiveCountry,
        source: String(context.source || 'server'),
        rawShowJamaicaHub: true
      });
    }
    var normalizedShowJamaicaHub = effectiveCountry === 'JM' || context.showJamaicaHub === true;
    publishPersonalizationContext(Object.assign({}, context, { showJamaicaHub: normalizedShowJamaicaHub }));
    hideJamaicaElements(normalizedShowJamaicaHub);
    applyDashboardVariant(effectiveCountry);
    applyCountryTheme(effectiveCountry);
    insertSidebarSwitcher(context);
    createHeaderExperienceSelector(context);
    showFirstVisitPickerIfNeeded(context);

    var onJamaicaPage = window.location.pathname.indexOf('jamaica-workforce-accelerator.html') !== -1;
    if (onJamaicaPage && !normalizedShowJamaicaHub) {
      window.location.replace('dashboard.html?experience=global');
    }
  }

  function applyLiveExperienceRefresh(countryCode) {
    var effective = normalizeCountryCode(countryCode || 'GLOBAL');
    applyDashboardVariant(effective);
    applyCountryTheme(effective);
    hideJamaicaElements(effective === 'JM');
    updateHeaderButtonStates(effective);

    var sidebarSelect = document.getElementById('rrExpCountrySelect');
    if (sidebarSelect) {
      sidebarSelect.value = effective;
    }
  }

  // Listen for same-tab personalization changes and refresh UI immediately.
  document.addEventListener('rr:personalization-updated', function (event) {
    var detail = event && event.detail ? event.detail : null;
    if (detail && detail.effectiveCountry) {
      applyLiveExperienceRefresh(detail.effectiveCountry);
    }
  });

  // Listen for cross-tab updates so open dashboards update without manual reload.
  window.addEventListener('storage', function (event) {
    if (!event || event.key !== LOCAL_STORAGE_KEY) return;
    applyLiveExperienceRefresh(event.newValue || 'GLOBAL');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
