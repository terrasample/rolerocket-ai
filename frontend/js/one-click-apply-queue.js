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
  let autopilotSettings = {
    mode: 'manual',
    maxDailyApplications: 5,
    excludedCompanies: [],
    requireApprovalForTopJobs: true,
    topJobMatchThreshold: 85
  };

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

  function prettyMode(mode) {
    if (mode === 'one-tap') return 'One-Tap';
    if (mode === 'autopilot') return 'Autopilot';
    return 'Manual';
  }

  async function loadAutopilotSettings() {
    try {
      const response = await fetch(buildApiUrl('/api/apply/autopilot/settings'), {
        headers: getHeaders(false)
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      autopilotSettings = {
        ...autopilotSettings,
        ...(data.settings || {})
      };
    } catch {
      // Leave defaults if settings are unavailable.
    }
  }

  function appendAutopilotSettingsButton() {
    const secondaryActions = document.querySelector('.tool-secondary-actions');
    if (!secondaryActions || document.getElementById('autopilotSettingsBtn')) return;

    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'autopilotSettingsBtn';
    settingsBtn.type = 'button';
    settingsBtn.className = 'auth-submit-btn tool-action-btn tool-action-btn--secondary';
    settingsBtn.textContent = 'Autopilot Settings';
    secondaryActions.appendChild(settingsBtn);

    settingsBtn.addEventListener('click', async function () {
      const modeInput = String(prompt('Autopilot mode: manual, one-tap, or autopilot', autopilotSettings.mode) || '').trim().toLowerCase();
      if (!['manual', 'one-tap', 'autopilot'].includes(modeInput)) {
        setMessage('Settings unchanged. Please enter manual, one-tap, or autopilot.', '#dc2626');
        return;
      }

      const maxInput = prompt('Max daily applications (1-25)', String(autopilotSettings.maxDailyApplications || 5));
      const maxDailyApplications = Number.parseInt(String(maxInput || '').trim(), 10);
      if (Number.isNaN(maxDailyApplications) || maxDailyApplications < 1 || maxDailyApplications > 25) {
        setMessage('Settings unchanged. Max daily applications must be between 1 and 25.', '#dc2626');
        return;
      }

      const blockedInput = String(prompt('Excluded companies (comma-separated)', (autopilotSettings.excludedCompanies || []).join(', ')) || '');
      const excludedCompanies = blockedInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30);

      const requireApprovalInput = String(prompt('Require approval for top-match jobs? yes or no', autopilotSettings.requireApprovalForTopJobs ? 'yes' : 'no') || '').trim().toLowerCase();
      const requireApprovalForTopJobs = requireApprovalInput !== 'no';

      const thresholdInput = prompt('Top-match threshold (1-100)', String(autopilotSettings.topJobMatchThreshold || 85));
      const topJobMatchThreshold = Number.parseInt(String(thresholdInput || '').trim(), 10);
      if (Number.isNaN(topJobMatchThreshold) || topJobMatchThreshold < 1 || topJobMatchThreshold > 100) {
        setMessage('Settings unchanged. Top-match threshold must be between 1 and 100.', '#dc2626');
        return;
      }

      const payload = {
        mode: modeInput,
        maxDailyApplications,
        excludedCompanies,
        requireApprovalForTopJobs,
        topJobMatchThreshold
      };

      try {
        const response = await fetch(buildApiUrl('/api/apply/autopilot/settings'), {
          method: 'PUT',
          headers: getHeaders(true),
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not save autopilot settings.');
        autopilotSettings = {
          ...autopilotSettings,
          ...(data.settings || payload)
        };
        setMessage(`Autopilot settings saved. Mode: ${prettyMode(autopilotSettings.mode)}.`, '#16a34a');
      } catch (error) {
        setMessage(error.message || 'Could not save autopilot settings.', '#dc2626');
      }
    });
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
    setMessage('Running controlled apply flow...', '#475569');

    try {
      const runAutopilot = async function (confirmed) {
        const response = await fetch(buildApiUrl('/api/apply/autopilot/run'), {
          method: 'POST',
          headers: getHeaders(true),
          body: JSON.stringify({ mode: autopilotSettings.mode, confirmed })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not run apply flow.');
        return data;
      };

      let data = await runAutopilot(false);
      if (data.requiresConfirmation) {
        const plannedCount = Array.isArray(data.previewJobs) ? data.previewJobs.length : 0;
        const shouldContinue = window.confirm(`One-Tap will process ${plannedCount} job(s). Continue?`);
        if (!shouldContinue) {
          setMessage('One-Tap run canceled.', '#475569');
          return;
        }
        data = await runAutopilot(true);
      }

      if (data.mode === 'manual') {
        const previewCount = Array.isArray(data.previewJobs) ? data.previewJobs.length : 0;
        setMessage(`Manual mode preview ready: ${previewCount} job(s). Switch mode in Autopilot Settings to send/open.`, '#2563eb');
        return;
      }

      const jobsToOpen = Array.isArray(data.jobsToOpen) ? data.jobsToOpen : [];
      if (!jobsToOpen.length) {
        setMessage('No eligible ready jobs found within your current guardrails.', '#dc2626');
        await loadQueue();
        await loadTopMatches();
        return;
      }

      let openedCount = 0;
      for (const job of jobsToOpen) {
        const link = String(job.link || '').trim();
        const opened = window.open(link, '_blank', 'noopener,noreferrer');
        if (opened) openedCount += 1;
      }

      const approvalCount = Array.isArray(data.approvalRequiredJobs) ? data.approvalRequiredJobs.length : 0;
      await loadQueue();
      await loadTopMatches();
      const summary = [
        `Mode ${prettyMode(data.mode)}: opened ${openedCount} tab${openedCount === 1 ? '' : 's'} and moved ${Number(data.appliedCount || 0)} job${Number(data.appliedCount || 0) === 1 ? '' : 's'} to Applied.`
      ];
      if (approvalCount) {
        summary.push(`${approvalCount} top-match job${approvalCount === 1 ? '' : 's'} held for manual approval.`);
      }
      setMessage(summary.join(' '), '#16a34a');
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
  loadAutopilotSettings();
  appendAutopilotSettingsButton();
});