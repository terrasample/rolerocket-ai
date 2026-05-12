(function () {
  var CONTEXT_ENDPOINT = '/api/experience/context';
  var PREFERENCE_ENDPOINT = '/api/experience/preference';
  var LOCAL_STORAGE_KEY = 'rr_exp_country_local_v1';

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
    return {
      detectedCountry: 'GLOBAL',
      selectedCountry: getSavedLocalCountry() || '',
      effectiveCountry: getSavedLocalCountry() || 'GLOBAL',
      source: 'system',
      requiresChoice: false,
      showJamaicaHub: getSavedLocalCountry() === 'JM',
      experienceVariant: getSavedLocalCountry() === 'JM' ? 'jamaica' : 'global',
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
      return Object.assign(defaultContext(), data || {});
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
          meta: 'Austin, Texas, United States · Product',
          href: 'job-search.html?query=Product%20Manager&source=market&region=us'
        },
        {
          title: 'AI/ML Engineer',
          meta: 'Seattle, Washington, United States · Engineering',
          href: 'job-search.html?query=AI%20ML%20Engineer&source=market&region=us'
        },
        {
          title: 'Software Engineer',
          meta: 'New York, New York, United States · Engineering',
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
    list.innerHTML = jobs.map(function (job) {
      return [
        '<div class="rr-shot-row">',
        '  <div>',
        '    <div class="title">' + escapeHtml(job.title) + '</div>',
        '    <div class="meta">' + escapeHtml(job.meta) + '</div>',
        '  </div>',
        '  <a class="rr-shot-apply" href="' + escapeHtml(job.href) + '">Apply</a>',
        '</div>'
      ].join('');
    }).join('');
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

  function ensureStyle() {
    if (document.getElementById('rrExpCountryStyle')) return;
    var style = document.createElement('style');
    style.id = 'rrExpCountryStyle';
    style.textContent = [
      '.rr-exp-country-wrap{margin:10px 0 14px;padding:10px;border-radius:10px;background:rgba(15,23,42,.65);border:1px solid rgba(59,130,246,.28);}',
      '.rr-exp-country-wrap label{display:block;color:#a5b4fc;font-weight:700;font-size:.77rem;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;}',
      '.rr-exp-country-row{display:flex;gap:8px;align-items:center;}',
      '.rr-exp-country-row select{flex:1;min-width:0;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px;}',
      '.rr-exp-country-row button{border:1px solid #3b82f6;background:#1d4ed8;color:#eff6ff;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer;}',
      '.rr-exp-overlay{position:fixed;inset:0;background:rgba(2,6,23,.75);display:grid;place-items:center;z-index:9999;padding:16px;}',
      '.rr-exp-card{width:min(460px,100%);background:linear-gradient(180deg,#0f172a 0%,#111827 100%);border:1px solid rgba(59,130,246,.4);border-radius:14px;padding:20px;color:#e2e8f0;box-shadow:0 20px 50px rgba(2,6,23,.55);}',
      '.rr-exp-card h3{margin:0 0 8px;font-size:1.2rem;color:#f8fafc;}',
      '.rr-exp-card p{margin:0 0 14px;color:#cbd5e1;line-height:1.5;}',
      '.rr-exp-card select{width:100%;margin-bottom:12px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:10px;}',
      '.rr-exp-card button{width:100%;border:1px solid #3b82f6;background:#1d4ed8;color:#eff6ff;border-radius:8px;padding:10px 12px;font-weight:800;cursor:pointer;}'
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
        hideJamaicaElements(saved.showJamaicaHub);
        applyDashboardVariant(selected);
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

    var card = document.createElement('div');
    card.className = 'rr-exp-card';

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

    button.addEventListener('click', async function () {
      var selected = (select.value || 'GLOBAL').toUpperCase();
      button.disabled = true;
      button.textContent = 'Saving...';
      try {
        var saved = await savePreference(selected);
        hideJamaicaElements(saved.showJamaicaHub);
        applyDashboardVariant(selected);
        overlay.remove();
      } catch (_) {
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
  }

  async function init() {
    ensureStyle();
    var context = await fetchExperienceContext();

    hideJamaicaElements(context.showJamaicaHub);
    applyDashboardVariant(context.effectiveCountry || 'GLOBAL');
    insertSidebarSwitcher(context);
    showFirstVisitPickerIfNeeded(context);

    var onJamaicaPage = window.location.pathname.indexOf('jamaica-workforce-accelerator.html') !== -1;
    if (onJamaicaPage && !context.showJamaicaHub) {
      window.location.replace('dashboard.html?experience=global');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
