// Job Search Logic

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');

  searchBtn.addEventListener('click', async function () {
    const query = document.getElementById('searchQuery').value.trim();
    if (!query) {
      results.innerHTML = '<div style="color:#dc2626;">Please enter a search term.</div>';
      return;
    }
    results.innerHTML = 'Searching...';
    try {
      const res = await fetch(`/api/jobs/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.jobs) && data.jobs.length > 0) {
        results.innerHTML = data.jobs.map(job =>
          `<div class='mini-job-card' style='margin-bottom:12px;'>
            <strong>${job.title || 'Untitled Job'}</strong><br>
            <span>${job.company || 'Unknown Company'}</span><br>
            <small>📍 ${job.location || 'Unknown Location'}</small><br>
            <a href='${job.link || '#'}' target='_blank' rel='noopener noreferrer'>View & Apply</a>
          </div>`
        ).join('');
      } else {
        results.innerHTML = '<div>No jobs found for your search.</div>';
      }
    } catch (err) {
      results.innerHTML = '<div style="color:#dc2626;">Error searching for jobs.</div>';
    }
  });
});
