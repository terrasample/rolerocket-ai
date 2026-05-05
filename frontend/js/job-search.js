// Job Search Logic with employer-first discovery enhancements.

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');
  const queryInput = document.getElementById('searchQuery');
  const followedBar = document.getElementById('followedEmployersBar');

  const FOLLOWED_EMPLOYERS_KEY = 'rr_followed_employers_v1';

  function safeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

      results.innerHTML =
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

    const encoded = encodeURIComponent(String(searchSeed || '').trim());
    const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encoded}`;
    const googleUrl = `https://www.google.com/search?q=${encoded}+jobs+Jamaica`;
    const indeedUrl = `https://jm.indeed.com/jobs?q=${encoded}`;

    results.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;">${fromMarket ? `Find <strong>${safeHtml(searchSeed)}</strong> jobs now:` : `${searchSeed ? `<strong>${safeHtml(searchSeed)}</strong>` : 'This search'} has no current match in the internal partner board.`}</div>
      <div style="color:#475569;font-size:.95rem;line-height:1.6;margin-bottom:10px;">Choose a platform below to search live listings - links open the search pre-filled:</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a href="${linkedInUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;">🔵 LinkedIn Jobs</a>
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;">🔍 Google Jobs</a>
        <a href="${indeedUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:10px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;">🟢 Indeed Jamaica</a>
      </div>
    `;

    if (fromMarket) {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function runSearch(explicitQuery, options) {
    const opts = options || {};
    const raw = String(explicitQuery || queryInput?.value || '').trim();
    if (!raw) {
      results.innerHTML = '<div style="color:#dc2626;">Please enter a search term.</div>';
      return;
    }

    const parsed = parseSearch(raw);
    parsed.raw = raw;

    if (queryInput) queryInput.value = raw;

    // Legacy market links should jump directly to a live source listing.
    if (opts.fromMarket) {
      try {
        const title = parsed.keywordQuery || parsed.employerQuery || raw;
        const params = new URLSearchParams({ title: title, location: 'Jamaica', limit: '1' });
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

      const encoded = encodeURIComponent(parsed.keywordQuery || parsed.employerQuery || raw);
      window.location.href = `https://jm.indeed.com/jobs?q=${encoded}`;
      return;
    }

    results.innerHTML = 'Searching live jobs...';

    try {
      const boardQuery = parsed.keywordQuery || parsed.employerQuery || raw;
      const res = await fetch(`/api/jobs/board?q=${encodeURIComponent(boardQuery)}&limit=20`);
      const data = await res.json();
      renderJobs(Array.isArray(data.jobs) ? data.jobs : [], parsed, opts);
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
  const source = String(params.get('source') || '').trim().toLowerCase();
  if (initialQuery) runSearch(initialQuery, { fromMarket: source === 'market' });
});
