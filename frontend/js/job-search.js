// Job Search Logic with employer-first discovery enhancements.

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');
  const queryInput = document.getElementById('searchQuery');
  const followedBar = document.getElementById('followedEmployersBar');
  let activeLocation = '';
  let activeSalaryMin = 0;

  const FOLLOWED_EMPLOYERS_KEY = 'rr_followed_employers_v1';
  const DASHBOARD_TOP_MATCHES_KEY = 'rr_dashboard_top_matches_v1';

  function safeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const JOB_TEXT_NOISE_REGEX = /(skip to main content|this button displays|jobs people learning|clear text|join or sign in|privacy policy|cookie policy|forgot password|email or phone|already on linkedin)/i;

  function isValidDashboardMatch(job) {
    const title = String(job && job.title || '').trim();
    const company = String(job && job.company || '').trim();
    const location = String(job && job.location || '').trim();
    const link = String(job && job.link || '').trim();
    const combined = [title, company, location].join(' ');

    if (!title || !company || !location) return false;
    if (title.length > 140 || company.length > 90) return false;
    if (JOB_TEXT_NOISE_REGEX.test(combined)) return false;
    if (String(job && job.source || '').toLowerCase().includes('state market fallback')) return false;
    if (!/^https?:\/\//i.test(link)) return false;

    return true;
  }

  function readFollowedEmployers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FOLLOWED_EMPLOYERS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function writeFollowedEmployers(list) {
    try {
      localStorage.setItem(FOLLOWED_EMPLOYERS_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 24) : []));
    } catch (_) {
      // ignore storage issues
    }
  }

  function normalizeCompanyName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function canonicalCompanyKey(name) {
    return normalizeCompanyName(name).replace(/\s+/g, '');
  }

  function parseSearch(rawQuery) {
    const text = String(rawQuery || '').trim();
    if (!text) return { keywordQuery: '', employerQuery: '' };

    const companyMatch = text.match(/(?:^|\s)(?:company|employer)\s*:\s*([^|]+)/i);
    if (companyMatch && companyMatch[1]) {
      const employerQuery = String(companyMatch[1] || '').trim();
      const withoutTag = text.replace(companyMatch[0], ' ').trim();
      return {
        keywordQuery: withoutTag,
        employerQuery: employerQuery
      };
    }

    return { keywordQuery: text, employerQuery: '' };
  }

  function parseSalaryNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value !== 'string') return 0;
    const numbers = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
    if (!numbers || !numbers.length) return 0;
    const parsed = numbers.map(function (n) { return Number(n); }).filter(function (n) {
      return Number.isFinite(n) && n > 0;
    });
    if (!parsed.length) return 0;
    return Math.max.apply(null, parsed);
  }

  function extractJobSalaryMax(job) {
    if (!job || typeof job !== 'object') return 0;

    const salaryRange = job.salaryRange;
    const rangeMin = Number(salaryRange && salaryRange.min) || 0;
    const rangeMax = Number(salaryRange && salaryRange.max) || 0;
    const rangeEstimated = Number(salaryRange && salaryRange.estimated) || 0;

    let maxSalary = Math.max(rangeMax, rangeMin, rangeEstimated);

    if (!(maxSalary > 0)) {
      const directMax = Number(job.salaryMax || job.salary_max || 0);
      const directMin = Number(job.salaryMin || job.salary_min || 0);
      maxSalary = Math.max(directMax, directMin);
    }

    if (!(maxSalary > 0)) {
      maxSalary = Math.max(
        parseSalaryNumber(job.salary),
        parseSalaryNumber(job.compensation),
        parseSalaryNumber(job.pay)
      );
    }

    return maxSalary > 0 ? maxSalary : 0;
  }

  function resolveActiveSalaryMin(params) {
    const fromUrl = Number(params.get('salaryMin') || params.get('minSalary') || 0) || 0;
    if (fromUrl > 0) return Math.round(fromUrl);

    try {
      const draft = JSON.parse(localStorage.getItem('rr_profile_draft_v1') || 'null');
      const fromDraft = Number(draft && draft.salaryMin) || 0;
      if (fromDraft > 0) return Math.round(fromDraft);
    } catch (_) {
      // ignore malformed local storage
    }

    return 0;
  }

  function applySalaryFilter(jobs, salaryMin) {
    const min = Number(salaryMin || 0) || 0;
    if (!(min > 0)) {
      return {
        jobs: Array.isArray(jobs) ? jobs : [],
        minSalary: 0,
        matchedKnownCount: 0,
        knownSalaryCount: 0,
        unknownSalaryCount: 0,
        filterApplied: false,
        filterBypassed: false
      };
    }

    const base = Array.isArray(jobs) ? jobs : [];
    const known = [];
    const matched = [];

    base.forEach(function (job) {
      const maxSalary = extractJobSalaryMax(job);
      if (maxSalary > 0) {
        known.push(job);
        if (maxSalary >= min) matched.push(job);
      }
    });

    if (!known.length) {
      return {
        jobs: base,
        minSalary: min,
        matchedKnownCount: 0,
        knownSalaryCount: 0,
        unknownSalaryCount: base.length,
        filterApplied: false,
        filterBypassed: true
      };
    }

    return {
      jobs: matched,
      minSalary: min,
      matchedKnownCount: matched.length,
      knownSalaryCount: known.length,
      unknownSalaryCount: Math.max(0, base.length - known.length),
      filterApplied: true,
      filterBypassed: false
    };
  }

  function renderFollowedEmployersBar() {
    if (!followedBar) return;
    const followed = readFollowedEmployers();
    if (!followed.length) {
      followedBar.style.display = 'none';
      followedBar.innerHTML = '';
      return;
    }

    followedBar.style.display = 'block';
    followedBar.innerHTML =
      '<div style="font-size:.9rem;color:#334155;margin-bottom:6px;font-weight:700;">Followed employers</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      followed.map(function (name) {
        return (
          '<button type="button" class="rr-followed-employer-chip" data-employer="' + safeHtml(name) + '" style="border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:6px 10px;font-size:.82rem;cursor:pointer;">' +
          '🏢 ' + safeHtml(name) +
          '</button>'
        );
      }).join('') +
      '</div>';

    followedBar.querySelectorAll('.rr-followed-employer-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const employer = String(btn.getAttribute('data-employer') || '').trim();
        if (!employer) return;
        runSearch('company:' + employer);
      });
    });
  }

  function isFollowedEmployer(companyName) {
    const key = canonicalCompanyKey(companyName);
    return readFollowedEmployers().some(function (name) {
      return canonicalCompanyKey(name) === key;
    });
  }

  async function syncEmployerToAlertDefaults(companyName, shouldFollow) {
    const token = (typeof getStoredToken === 'function' ? getStoredToken() : '')
      || localStorage.getItem('token')
      || sessionStorage.getItem('token')
      || '';
    if (!token) return;

    const apiBase = typeof getApiBase === 'function' ? getApiBase() : '';
    if (!apiBase) return;

    try {
      const defaultsRes = await fetch(apiBase + '/api/job-alerts/defaults', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!defaultsRes.ok) return;

      const payload = await defaultsRes.json();
      const defaults = payload.defaults || {};
      const existing = Array.isArray(defaults.includeKeywords) ? defaults.includeKeywords.map(String) : [];
      const targetTag = 'employer:' + String(companyName || '').trim();

      let nextKeywords = existing.filter(Boolean);
      if (shouldFollow) {
        if (!nextKeywords.some(function (k) { return k.toLowerCase() === targetTag.toLowerCase(); })) {
          nextKeywords.push(targetTag);
        }
      } else {
        nextKeywords = nextKeywords.filter(function (k) {
          return k.toLowerCase() !== targetTag.toLowerCase();
        });
      }

      await fetch(apiBase + '/api/job-alerts/defaults', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          location: defaults.location || '',
          industries: Array.isArray(defaults.industries) ? defaults.industries : [],
          includeKeywords: nextKeywords,
          seniorityLevels: Array.isArray(defaults.seniorityLevels) ? defaults.seniorityLevels : [],
          workModes: Array.isArray(defaults.workModes) ? defaults.workModes : [],
          employmentTypes: Array.isArray(defaults.employmentTypes) ? defaults.employmentTypes : [],
          salaryMin: Number(defaults.salaryMin || 0) || 0
        })
      });
    } catch (_) {
      // Best effort only; local follow still works.
    }
  }

  async function toggleFollowEmployer(companyName) {
    const company = String(companyName || '').trim();
    if (!company) return;

    const followed = readFollowedEmployers();
    const key = canonicalCompanyKey(company);
    const exists = followed.some(function (name) {
      return canonicalCompanyKey(name) === key;
    });

    let next;
    let nowFollowed;

    if (exists) {
      next = followed.filter(function (name) {
        return canonicalCompanyKey(name) !== key;
      });
      nowFollowed = false;
    } else {
      next = followed.concat(company).slice(0, 24);
      nowFollowed = true;
    }

    writeFollowedEmployers(next);
    renderFollowedEmployersBar();
    await syncEmployerToAlertDefaults(company, nowFollowed);

    const current = String(queryInput?.value || '').trim();
    if (current) runSearch(current);
  }

  function sortJobsByEmployerMatch(jobs, employerQuery) {
    const employerKey = canonicalCompanyKey(employerQuery);
    if (!employerKey) return jobs.slice();

    return jobs.slice().sort(function (a, b) {
      const aKey = canonicalCompanyKey(a && a.company);
      const bKey = canonicalCompanyKey(b && b.company);
      const aScore = aKey === employerKey ? 2 : (aKey.includes(employerKey) ? 1 : 0);
      const bScore = bKey === employerKey ? 2 : (bKey.includes(employerKey) ? 1 : 0);
      return bScore - aScore;
    });
  }

  function renderJobs(jobs, parsedQuery, options) {
    const fromMarket = options.fromMarket === true;
    const locationQuery = String(options.location || activeLocation || '').trim();
    const salaryMeta = options.salaryMeta || null;
    const employerQuery = parsedQuery.employerQuery;
    const keywordQuery = parsedQuery.keywordQuery;
    const searchSeed = keywordQuery || employerQuery || parsedQuery.raw;

    if (Array.isArray(jobs) && jobs.length > 0) {
      const sorted = sortJobsByEmployerMatch(jobs, employerQuery);
      const filtered = employerQuery
        ? sorted.filter(function (job) {
            const company = normalizeCompanyName(job && job.company);
            const needle = normalizeCompanyName(employerQuery);
            return company.includes(needle) || needle.includes(company);
          })
        : sorted;

      const finalList = filtered.length ? filtered : sorted;

      const salaryBanner = salaryMeta && salaryMeta.minSalary > 0
        ? '<div style="margin-bottom:10px;color:#334155;font-size:.95rem;">' +
            (salaryMeta.filterBypassed
              ? 'Salary filter set to <strong>$' + safeHtml(String(Math.round(salaryMeta.minSalary)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + '+</strong>, but salary data is unavailable for these listings, so all results are shown.'
              : 'Salary filter: <strong>$' + safeHtml(String(Math.round(salaryMeta.minSalary)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + '+</strong> (' + safeHtml(String(salaryMeta.matchedKnownCount)) + ' matches with salary data, ' + safeHtml(String(salaryMeta.unknownSalaryCount)) + ' with unknown salary).') +
          '</div>'
        : '';

      results.innerHTML =
        salaryBanner +
        (employerQuery
          ? '<div style="margin-bottom:10px;color:#334155;font-size:.95rem;">Showing employer-focused results for <strong>' + safeHtml(employerQuery) + '</strong>.</div>'
          : '') +
        finalList.map(function (job) {
          const company = String(job.company || 'Unknown Company');
          const followed = isFollowedEmployer(company);
          return (
            '<div class="mini-job-card" style="margin-bottom:12px;">' +
              '<strong>' + safeHtml(job.title || 'Untitled Job') + '</strong><br>' +
              '<button type="button" class="rr-company-chip" data-company="' + safeHtml(company) + '" style="border:none;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:999px;font-size:.82rem;font-weight:700;cursor:pointer;margin:4px 0 6px 0;">🏢 ' + safeHtml(company) + '</button><br>' +
              '<small>📍 ' + safeHtml(job.location || 'Unknown Location') + '</small><br>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
                '<a href="' + safeHtml(job.link || '#') + '" target="_blank" rel="noopener noreferrer">View & Apply</a>' +
                '<button type="button" class="rr-follow-employer" data-company="' + safeHtml(company) + '" style="border:1px solid ' + (followed ? '#334155' : '#2563eb') + ';background:' + (followed ? '#334155' : '#eff6ff') + ';color:' + (followed ? '#fff' : '#1d4ed8') + ';border-radius:8px;padding:2px 8px;font-size:.78rem;cursor:pointer;">' + (followed ? 'Following' : 'Follow employer') + '</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');

      results.querySelectorAll('.rr-company-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          const company = String(chip.getAttribute('data-company') || '').trim();
          if (!company) return;
          runSearch('company:' + company);
        });
      });

      results.querySelectorAll('.rr-follow-employer').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const company = String(btn.getAttribute('data-company') || '').trim();
          toggleFollowEmployer(company);
        });
      });

      return;
    }

    if (salaryMeta && salaryMeta.minSalary > 0 && salaryMeta.filterApplied && salaryMeta.knownSalaryCount > 0) {
      results.innerHTML = '<div style="margin-bottom:8px;font-weight:700;">No current jobs match a salary floor of <strong>$' + safeHtml(String(Math.round(salaryMeta.minSalary)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) + '+</strong>.</div>' +
        '<div style="color:#475569;font-size:.95rem;line-height:1.6;">We found <strong>' + safeHtml(String(salaryMeta.knownSalaryCount)) + '</strong> jobs with salary data, but none met that minimum. Try lowering the salary floor or broadening the role title.</div>';
      return;
    }

    const linkedInParams = new URLSearchParams({ keywords: String(searchSeed || '').trim() });
    if (locationQuery) linkedInParams.set('location', locationQuery);
    const linkedInUrl = `https://www.linkedin.com/jobs/search/?${linkedInParams.toString()}`;
    const googleTerms = [String(searchSeed || '').trim(), 'jobs', locationQuery].filter(Boolean).join(' ');
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleTerms)}`;

    results.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;">${fromMarket ? `Find <strong>${safeHtml(searchSeed)}</strong> jobs now:` : `${searchSeed ? `<strong>${safeHtml(searchSeed)}</strong>` : 'This search'} has no current match in the internal partner board.`}</div>
      <div style="color:#475569;font-size:.95rem;line-height:1.6;margin-bottom:10px;">Choose a platform below to search live listings - links open the search pre-filled:</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${linkedInUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;">🔵 LinkedIn Jobs</a>
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;">🔍 Google Jobs</a>
      </div>
    `;

    if (fromMarket) {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderDashboardTopMatches(payload) {
    const jobs = Array.isArray(payload && payload.jobs) ? payload.jobs.filter(isValidDashboardMatch) : [];
    const query = String((payload && payload.query) || '').trim();
    const location = String((payload && payload.location) || '').trim();

    if (queryInput && query) {
      queryInput.value = query;
    }

    if (!jobs.length) {
      results.innerHTML = '<div style="color:#475569;">No top matches were available from dashboard. Run a search to refresh matches.</div>';
      return;
    }

    const header = [
      '<div style="margin-bottom:10px;color:#334155;font-size:.95rem;">',
      'Showing <strong>' + safeHtml(String(jobs.length)) + '</strong> dashboard matches',
      (query ? ' for <strong>' + safeHtml(query) + '</strong>' : ''),
      (location ? ' in <strong>' + safeHtml(location) + '</strong>' : ''),
      '.</div>'
    ].join('');

    const cards = jobs.map(function (job) {
      const fit = Number(job.fitScore || 0);
      const fitText = Number.isFinite(fit) ? Math.max(0, Math.min(96, Math.round(fit))) : 0;
      const externalLink = String(job.link || '').trim();
      const safeLink = /^https?:\/\//i.test(externalLink) ? externalLink : '#';

      return (
        '<div class="mini-job-card" style="margin-bottom:12px;">' +
          '<strong>' + safeHtml(job.title || 'Untitled Job') + '</strong><br>' +
          '<span style="font-size:.92rem;color:#334155;">' + safeHtml(job.company || 'Unknown Company') + '</span><br>' +
          '<small>📍 ' + safeHtml(job.location || 'Unknown Location') + '</small><br>' +
          '<small style="display:inline-block;margin-top:6px;border:1px solid rgba(16,185,129,.45);background:rgba(6,95,70,.22);color:#065f46;border-radius:999px;padding:2px 8px;font-weight:700;">Fit ' + safeHtml(String(fitText)) + '%</small><br>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">' +
            '<a href="' + safeHtml(safeLink) + '" target="_blank" rel="noopener noreferrer">View & Apply</a>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    results.innerHTML = header + cards;
  }

  async function hydrateDashboardTopMatches(initialQuery, initialLocation) {
    const normalizedQuery = String(initialQuery || '').trim().toLowerCase();
    const normalizedLocation = String(initialLocation || '').trim().toLowerCase();
    const payloadMatchesRequest = function (candidate) {
      if (!candidate || typeof candidate !== 'object') return false;
      const candidateQuery = String(candidate.query || '').trim().toLowerCase();
      const candidateLocation = String(candidate.location || '').trim().toLowerCase();
      if (normalizedQuery && candidateQuery !== normalizedQuery) return false;
      if (normalizedLocation && candidateLocation !== normalizedLocation) return false;
      return true;
    };

    let payload = null;
    try {
      payload = JSON.parse(sessionStorage.getItem(DASHBOARD_TOP_MATCHES_KEY) || 'null');
    } catch (_) {
      payload = null;
    }

    if (!payload) {
      try {
        payload = JSON.parse(localStorage.getItem(DASHBOARD_TOP_MATCHES_KEY) || 'null');
      } catch (_) {
        payload = null;
      }
    }

    if (payload && Array.isArray(payload.jobs)) {
      payload.jobs = payload.jobs.filter(isValidDashboardMatch);
    }

    if (payload && !payloadMatchesRequest(payload)) {
      payload = null;
      try {
        sessionStorage.removeItem(DASHBOARD_TOP_MATCHES_KEY);
      } catch (_) {
        // ignore
      }
      try {
        localStorage.removeItem(DASHBOARD_TOP_MATCHES_KEY);
      } catch (_) {
        // ignore
      }
    }

    if (payload && Array.isArray(payload.jobs) && payload.jobs.length) {
      renderDashboardTopMatches(payload);
      return true;
    }

    const q = String(initialQuery || '').trim();
    const location = String(initialLocation || '').trim();
    if (!q) return false;

    try {
      const params = new URLSearchParams({ title: q, limit: '20' });
      if (location) params.set('location', location);

      const res = await fetch('/api/jobs/scout?' + params.toString());
      if (!res.ok) return false;

      const data = await res.json();
      const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
      if (!jobs.length) return false;

      const projected = {
        query: q,
        location: location,
        jobs: jobs.map(function (job) {
          return {
            title: job && job.title,
            company: job && job.company,
            location: job && job.location,
            fitScore: Number((job && job.matchScore) || 0),
            link: job && (job.applyLink || job.applyUrl || job.url || job.jobUrl || job.link || ''),
            source: job && job.source
          };
        }).filter(function (job) {
          return /^https?:\/\//i.test(String(job.link || '').trim());
        })
      };

      if (!projected.jobs.length) return false;

      try {
        sessionStorage.setItem(DASHBOARD_TOP_MATCHES_KEY, JSON.stringify(projected));
        localStorage.setItem(DASHBOARD_TOP_MATCHES_KEY, JSON.stringify(projected));
      } catch (_) {
        // ignore
      }

      renderDashboardTopMatches(projected);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function runSearch(explicitQuery, options) {
    const opts = options || {};
    const raw = String(explicitQuery || queryInput?.value || '').trim();
    const location = String(opts.location || activeLocation || '').trim();
    const salaryMin = Number(opts.salaryMin || activeSalaryMin || 0) || 0;
    if (!raw) {
      results.innerHTML = '<div style="color:#dc2626;">Please enter a search term.</div>';
      return;
    }

    const parsed = parseSearch(raw);
    parsed.raw = raw;

    if (queryInput) queryInput.value = raw;
    if (location) activeLocation = location;
    if (salaryMin > 0) activeSalaryMin = salaryMin;

    // Legacy market links should jump directly to a live source listing.
    if (opts.fromMarket) {
      try {
        const title = parsed.keywordQuery || parsed.employerQuery || raw;
        const params = new URLSearchParams({ title: title, location: location || 'remote', limit: '1' });
        const res = await fetch(`/api/jobs/scout?${params.toString()}`);
        if (res.ok) {
          const payload = await res.json();
          const first = Array.isArray(payload?.jobs) ? payload.jobs[0] : null;
          const sourceLink = String(first?.link || '').trim();
          if (/^https?:\/\//i.test(sourceLink)) {
            window.location.href = sourceLink;
            return;
          }
        }
      } catch (_err) {
        // Fall back below if live source lookup fails.
      }

      const internalQuery = encodeURIComponent(parsed.keywordQuery || parsed.employerQuery || raw);
      window.location.href = `job-search.html?query=${internalQuery}&source=market`;
      return;
    }

    results.innerHTML = location ? `Searching live jobs in ${safeHtml(location)}...` : 'Searching live jobs...';

    try {
      const boardQuery = parsed.keywordQuery || parsed.employerQuery || raw;
      const endpoint = location
        ? `/api/jobs/scout?${new URLSearchParams({ title: boardQuery, location: location, limit: '20' }).toString()}`
        : `/api/jobs/board?q=${encodeURIComponent(boardQuery)}&limit=20`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const salaryMeta = applySalaryFilter(Array.isArray(data.jobs) ? data.jobs : [], salaryMin);
      renderJobs(salaryMeta.jobs, parsed, { ...opts, location: location, salaryMeta: salaryMeta });
    } catch (_err) {
      results.innerHTML = '<div style="color:#dc2626;">Error searching for jobs.</div>';
    }
  }

  searchBtn.addEventListener('click', function () {
    runSearch();
  });

  queryInput?.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') runSearch();
  });

  renderFollowedEmployersBar();

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q') || params.get('query') || params.get('employer') || '';
  activeLocation = String(params.get('location') || '').trim();
  activeSalaryMin = resolveActiveSalaryMin(params);
  const source = String(params.get('source') || '').trim().toLowerCase();
  if (source === 'dashboard-top-matches') {
    const initialLocation = activeLocation;
    hydrateDashboardTopMatches(initialQuery, initialLocation).then(function (ok) {
      if (!ok && initialQuery) runSearch(initialQuery, { fromMarket: false, location: initialLocation, salaryMin: activeSalaryMin });
    });
    return;
  }

  if (initialQuery) runSearch(initialQuery, { fromMarket: source === 'market', location: activeLocation, salaryMin: activeSalaryMin });
});
