document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('applyRole');
  const queueInput = document.getElementById('applyQueue');
  const queueBtn = document.getElementById('queueApplyBtn');
  const refreshBtn = document.getElementById('loadQueueBtn');
  const topMatchesBtn = document.getElementById('runOneClickApplyBtn');
  const autoSubmitBtn = document.getElementById('autoSubmitQueueBtn');
  const result = document.getElementById('applyQueueResult');
  const queuedJobsList = document.getElementById('queuedJobsList');
  const recommendationsList = document.getElementById('queueRecommendations');

  function getToken() {
    return typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
  }

  function buildApiUrl(path) {
    return typeof apiUrl === 'function' ? apiUrl(path) : path;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setMessage(message, color) {
    result.innerHTML = message ? `<div style="color:${color};">${message}</div>` : '';
  }

  function getHeaders(includeJson) {
    const token = getToken();
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function parseQueueEntries(rawValue) {
    return String(rawValue || '')
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function createJobPayload(entry, role) {
    const isUrl = /^https?:\/\//i.test(entry);
    let title = entry;
    let company = 'Manual Queue';
    let link = '';

    if (isUrl) {
      link = entry;
      try {
        const url = new URL(entry);
        company = url.hostname.replace(/^www\./i, '');
        title = role ? `${role} opportunity` : 'Queued application';
      } catch {
        title = role ? `${role} opportunity` : 'Queued application';
      }
    } else if (entry.includes('@')) {
      const [rawTitle, rawCompany] = entry.split('@');
      title = rawTitle.trim() || entry;
      company = rawCompany.trim() || company;
    }

    return {
      title,
      company,
      link,
      status: 'ready',
      notes: role ? `Queued from 1-Click Apply Queue for ${role}` : 'Queued from 1-Click Apply Queue'
    };
  }

  function renderEmptyState(container, message) {
    container.innerHTML = `<p class="queue-empty-state">${message}</p>`;
  }

  async function fetchJobs() {
    const response = await fetch(buildApiUrl('/api/jobs'), {
      headers: getHeaders(false)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load jobs.');
    return Array.isArray(data.jobs) ? data.jobs : [];
  }

  async function loadQueue() {
    try {
      const jobs = await fetchJobs();
      const visibleJobs = jobs.filter((job) => ['saved', 'ready', 'applied'].includes(String(job.status || '').toLowerCase()));

      if (!visibleJobs.length) {
        renderEmptyState(queuedJobsList, 'No queued jobs yet. Add roles or job links above to build your ready queue.');
        return;
      }

      queuedJobsList.innerHTML = visibleJobs.map((job) => {
        const jobId = escapeHtml(job._id);
        const title = escapeHtml(job.title || 'Untitled job');
        const company = escapeHtml(job.company || 'Unknown company');
        const status = escapeHtml(job.status || 'saved');
        const link = job.link ? `<a href="${escapeHtml(job.link)}" target="_blank" rel="noopener noreferrer">Open posting</a>` : 'Manual entry';
        const readyButton = status === 'ready'
          ? ''
          : `<button type="button" class="tool-action-btn--secondary" data-action="ready" data-job-id="${jobId}">Mark Ready</button>`;
        const appliedButton = status === 'applied'
          ? ''
          : `<button type="button" class="tool-action-btn--secondary" data-action="applied" data-job-id="${jobId}">Mark Applied</button>`;

        return `
          <article class="queue-job-card">
            <div class="queue-job-header">
              <h3 class="queue-job-title">${title}</h3>
              <span class="queue-status-chip">${status}</span>
            </div>
            <p class="queue-job-meta"><strong>${company}</strong><br>${link}</p>
            <div class="queue-job-actions">
              ${readyButton}
              ${appliedButton}
              <button type="button" class="tool-action-btn--secondary" data-action="delete" data-job-id="${jobId}">Remove</button>
            </div>
          </article>
        `;
      }).join('');
    } catch (error) {
      renderEmptyState(queuedJobsList, error.message || 'Could not load your queue right now.');
    }
  }

  async function loadTopMatches() {
    recommendationsList.innerHTML = '<p class="queue-empty-state">Loading top matches...</p>';
    try {
      const response = await fetch(buildApiUrl('/api/apply/one-click'), {
        method: 'POST',
        headers: getHeaders(false)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load top matches.');

      const topJobs = Array.isArray(data.topJobs) ? data.topJobs : [];
      if (!topJobs.length) {
        renderEmptyState(recommendationsList, 'No ready matches yet. Queue jobs or mark saved jobs as ready to populate this list.');
        return;
      }

      recommendationsList.innerHTML = topJobs.map((job) => `
        <article class="queue-match-card">
          <div class="queue-match-header">
            <h3 class="queue-match-title">${escapeHtml(job.title || 'Untitled job')}</h3>
            <span class="queue-status-chip">${escapeHtml(job.urgencyLabel || 'Ready')}</span>
          </div>
          <p class="queue-match-meta"><strong>${escapeHtml(job.company || 'Unknown company')}</strong><br>Match score: ${escapeHtml(job.matchScore || 0)}</p>
        </article>
      `).join('');
    } catch (error) {
      renderEmptyState(recommendationsList, error.message || 'Could not load top matches right now.');
    }
  }

  async function queueApplications() {
    const entries = parseQueueEntries(queueInput.value);
    const role = String(roleInput.value || '').trim();

    if (!entries.length) {
      setMessage('Add at least one job title or link before queueing applications.', '#dc2626');
      return;
    }

    queueBtn.disabled = true;
    setMessage('Queueing applications...', '#475569');

    try {
      for (const entry of entries) {
        const response = await fetch(buildApiUrl('/api/jobs/save'), {
          method: 'POST',
          headers: getHeaders(true),
          body: JSON.stringify(createJobPayload(entry, role))
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Failed to queue ${entry}`);
      }

      queueInput.value = '';
      setMessage(`Queued ${entries.length} application${entries.length === 1 ? '' : 's'} and marked them ready.`, '#16a34a');
      await loadQueue();
      await loadTopMatches();
    } catch (error) {
      setMessage(error.message || 'Could not queue applications right now.', '#dc2626');
    } finally {
      queueBtn.disabled = false;
    }
  }

  async function updateJob(jobId, action) {
    try {
      if (action === 'delete') {
        const response = await fetch(buildApiUrl(`/api/jobs/${jobId}`), {
          method: 'DELETE',
          headers: getHeaders(false)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to remove job.');
        setMessage('Removed job from queue.', '#16a34a');
      } else {
        const response = await fetch(buildApiUrl(`/api/jobs/${jobId}/status`), {
          method: 'PUT',
          headers: getHeaders(true),
          body: JSON.stringify({ status: action })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to update job status.');
        setMessage(action === 'applied' ? 'Marked job as applied.' : 'Marked job as ready.', '#16a34a');
      }

      await loadQueue();
      await loadTopMatches();
    } catch (error) {
      setMessage(error.message || 'Could not update the queue right now.', '#dc2626');
    }
  }

  async function autoSubmitReadyJobs() {
    autoSubmitBtn.disabled = true;
    setMessage('Auto-submit started: opening ready job links and updating pipeline status...', '#475569');

    try {
      const jobs = await fetchJobs();
      const readyJobs = jobs.filter((job) => String(job.status || '').toLowerCase() === 'ready');
      const readyWithLinks = readyJobs.filter((job) => /^https?:\/\//i.test(String(job.link || '').trim()));

      if (!readyWithLinks.length) {
        setMessage('No ready jobs with valid job links found. Add links or mark jobs ready first.', '#dc2626');
        return;
      }

      let openedCount = 0;
      let updatedCount = 0;

      for (const job of readyWithLinks) {
        const link = String(job.link || '').trim();
        const opened = window.open(link, '_blank', 'noopener,noreferrer');
        if (opened) openedCount += 1;

        const response = await fetch(buildApiUrl(`/api/jobs/${job._id}/status`), {
          method: 'PUT',
          headers: getHeaders(true),
          body: JSON.stringify({ status: 'applied' })
        });
        const data = await response.json();
        if (response.ok) {
          updatedCount += 1;
        } else {
          throw new Error(data.error || 'Failed to mark one or more jobs as applied.');
        }
      }

      await loadQueue();
      await loadTopMatches();
      setMessage(`Auto-submit complete: opened ${openedCount} job tab${openedCount === 1 ? '' : 's'} and marked ${updatedCount} role${updatedCount === 1 ? '' : 's'} as applied. Final submit steps on each site are still required.`, '#16a34a');
    } catch (error) {
      setMessage(error.message || 'Auto-submit could not complete right now.', '#dc2626');
    } finally {
      autoSubmitBtn.disabled = false;
    }
  }

  queueBtn?.addEventListener('click', queueApplications);
  refreshBtn?.addEventListener('click', async function () {
    setMessage('Refreshing queue...', '#475569');
    await loadQueue();
    await loadTopMatches();
    setMessage('Queue refreshed.', '#16a34a');
  });
  topMatchesBtn?.addEventListener('click', loadTopMatches);
  autoSubmitBtn?.addEventListener('click', autoSubmitReadyJobs);

  queuedJobsList?.addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-job-id][data-action]');
    if (!button) return;
    await updateJob(button.getAttribute('data-job-id'), button.getAttribute('data-action'));
  });

  loadQueue();
  loadTopMatches();
});