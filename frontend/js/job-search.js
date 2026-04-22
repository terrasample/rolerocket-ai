// Job Search Logic

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');
  const queryInput = document.getElementById('searchQuery');

  function renderJobs(jobs, query) {
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

    results.innerHTML = `<div>No live jobs found for ${query ? `<strong>${query}</strong>` : 'your search'}.</div>`;
  }

  async function runSearch(explicitQuery) {
    const query = String(explicitQuery || queryInput?.value || '').trim();
    if (!query) {
      results.innerHTML = '<div style="color:#dc2626;">Please enter a search term.</div>';
      return;
    }

    if (queryInput) queryInput.value = query;
    results.innerHTML = 'Searching live jobs...';

    try {
      const res = await fetch(`/api/jobs/board?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      renderJobs(Array.isArray(data.jobs) ? data.jobs : [], query);
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
  if (initialQuery) runSearch(initialQuery);
});
