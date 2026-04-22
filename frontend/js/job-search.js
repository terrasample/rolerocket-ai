// Job Search Logic

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');
  const queryInput = document.getElementById('searchQuery');

  function renderJobs(jobs, query, options = {}) {
    const fromMarket = options.fromMarket === true;

    if (Array.isArray(jobs) && jobs.length > 0) {
      results.innerHTML = jobs.map(job =>
        `<div class='mini-job-card' style='margin-bottom:12px;'>
          <strong>${job.title || 'Untitled Job'}</strong><br>
          <span>${job.company || 'Unknown Company'}</span><br>
          <small>📍 ${job.location || 'Unknown Location'}</small><br>
          <a href='${job.link || '#'}' target='_blank' rel='noopener noreferrer'>View & Apply</a>
        </div>`
      ).join('');
      return;
    }

    const encoded = encodeURIComponent(String(query || '').trim());
    const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encoded}`;
    const googleUrl = `https://www.google.com/search?q=${encoded}+jobs+Jamaica`;
    const indeedUrl = `https://jm.indeed.com/jobs?q=${encoded}`;

    results.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;">${fromMarket ? `Find <strong>${query}</strong> jobs now:` : `${query ? `<strong>${query}</strong>` : 'This search'} has no current match in the internal partner board.`}</div>
      <div style="color:#475569;font-size:.95rem;line-height:1.6;margin-bottom:10px;">Choose a platform below to search live listings — links open the search pre-filled:</div>
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

  async function runSearch(explicitQuery, options = {}) {
    const query = String(explicitQuery || queryInput?.value || '').trim();
    if (!query) {
      results.innerHTML = '<div style="color:#dc2626;">Please enter a search term.</div>';
      return;
    }

    if (queryInput) queryInput.value = query;

    // When arriving from a market job card, skip the internal board and show
    // live external search links immediately — the internal board has no listings yet.
    if (options.fromMarket) {
      renderJobs([], query, options);
      return;
    }

    results.innerHTML = 'Searching live jobs...';

    try {
      const res = await fetch(`/api/jobs/board?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      renderJobs(Array.isArray(data.jobs) ? data.jobs : [], query, options);
    } catch (err) {
      results.innerHTML = '<div style="color:#dc2626;">Error searching for jobs.</div>';
    }
  }

  searchBtn.addEventListener('click', function () {
    runSearch();
  });

  queryInput?.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') runSearch();
  });

  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('q');
  const source = String(params.get('source') || '').trim().toLowerCase();
  if (initialQuery) runSearch(initialQuery, { fromMarket: source === 'market' });
});
