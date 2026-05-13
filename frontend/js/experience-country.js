(function () {
  var CONTEXT_ENDPOINT = '/api/experience/context';
  var PREFERENCE_ENDPOINT = '/api/experience/preference';
  var LOCAL_STORAGE_KEY = 'rr_exp_country_local_v1';

  function normalizeCountryCode(value) {
    var code = String(value || '').trim().toUpperCase();
    if (code === 'GLOBAL' || code === 'JM' || code === 'US') return code;
    return 'GLOBAL';
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
    var normalized = {
      effectiveCountry: normalizeCountryCode(context && context.effectiveCountry),
      showJamaicaHub: !!(context && context.showJamaicaHub === true),
      requiresChoice: !!(context && context.requiresChoice === true),
      source: String((context && context.source) || 'client'),
      updatedAt: Date.now()
    };
    window.__rrPersonalization = normalized;
    window.__rrExperienceCountry = normalized.effectiveCountry;
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
      if (data && data.effectiveCountry) {
        setSavedLocalCountry(data.effectiveCountry);
      }
      var merged = Object.assign(defaultContext(), data || {});
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
          href: 'job-search.html?query=Customer%20Service%20Representative&source=market&region=jm'
        },
        {
          title: 'Administrative Assistant',
          meta: 'Montego Bay, Jamaica · Operations',
          href: 'job-search.html?query=Administrative%20Assistant&source=market&region=jm'
        },
        {
          title: 'Project Coordinator',
          meta: 'Portmore, Jamaica · Project Operations',
          href: 'job-search.html?query=Project%20Coordinator&source=market&region=jm'
        }
      ],
      US: [
        {
          title: 'Product Manager',
          meta: 'United States · Product',
          href: 'job-search.html?query=Product%20Manager&source=market&region=us'
        },
        {
          title: 'AI/ML Engineer',
          meta: 'United States · Engineering',
          href: 'job-search.html?query=AI%20ML%20Engineer&source=market&region=us'
        },
        {
          title: 'Software Engineer',
          meta: 'United States · Engineering',
          href: 'job-search.html?query=Software%20Engineer&source=market&region=us'
        }
      ],
      GLOBAL: [
        {
          title: 'Customer Success Manager',
          meta: 'Remote · Global Market',
          href: 'job-search.html?query=Customer%20Success%20Manager&source=market'
        },
        {
          title: 'Data Analyst',
          meta: 'Hybrid · International Opportunities',
          href: 'job-search.html?query=Data%20Analyst&source=market'
        },
        {
          title: 'Project Manager',
          meta: 'Remote · Cross-Region Roles',
          href: 'job-search.html?query=Project%20Manager&source=market'
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
        profileLabel: 'Market Readiness'
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
    applyJobMatches(countryCode);

    var badge = document.getElementById('rrShotBadge');
    if (badge) {
      badge.textContent = selected.badge;
      badge.style.display = 'inline-flex';
    }

    applyToolCards(countryCode);
  }

  function applyCountryTheme(countryCode) {
    var themes = {
      JM: {
        primary: '#007A5E',
        accent: '#FFD700',
        dark: '#000000',
        border: 'rgba(0, 122, 94, 0.4)',
        bg: 'rgba(0, 122, 94, 0.08)',
        label: '🇯🇲'
      },
      US: {
        primary: '#1D4ED8',
        accent: '#DC2626',
        dark: '#1E3A8A',
        border: 'rgba(29, 78, 216, 0.4)',
        bg: 'rgba(29, 78, 216, 0.08)',
        label: '🇺🇸'
      },
      GLOBAL: {
        primary: '#3B82F6',
        accent: '#06B6D4',
        dark: '#1E40AF',
        border: 'rgba(59, 130, 246, 0.4)',
        bg: 'rgba(59, 130, 246, 0.08)',
        label: '🌍'
      }
    };

    var theme = themes[countryCode] || themes.GLOBAL;
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
    if (!isDashboard || document.getElementById('rrExpHeaderSelector')) return;

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
            showJamaicaHub: saved && saved.showJamaicaHub === true && savedCountry === 'JM',
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
      ':root{--rr-exp-primary:#3b82f6;--rr-exp-accent:#06b6d4;--rr-exp-dark:#1e40af;--rr-exp-border:rgba(59,130,246,0.4);--rr-exp-bg:rgba(59,130,246,0.08);--rr-exp-label:"🌍";}',
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
          showJamaicaHub: saved && saved.showJamaicaHub === true && savedCountry === 'JM',
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
          showJamaicaHub: saved && saved.showJamaicaHub === true && savedCountry === 'JM',
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
    var normalizedShowJamaicaHub = context.showJamaicaHub === true && effectiveCountry === 'JM';
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
