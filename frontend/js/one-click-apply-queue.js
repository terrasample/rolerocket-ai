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
  const selectedJobSummary = document.getElementById('selectedJobSummary');
  const workflowJobDescription = document.getElementById('workflowJobDescription');
  const workflowResumeDraft = document.getElementById('workflowResumeDraft');
  const workflowCoverDraft = document.getElementById('workflowCoverDraft');
  const workflowFitScore = document.getElementById('workflowFitScore');
  const workflowChecklist = document.getElementById('workflowChecklist');
  const guidedApplyStatus = document.getElementById('guidedApplyStatus');
  const generateGuidedApplyBtn = document.getElementById('generateGuidedApplyBtn');
  const saveGuidedApplyBtn = document.getElementById('saveGuidedApplyBtn');
  const openApplicationBtn = document.getElementById('openApplicationBtn');
  const autoSubmitApplicationBtn = document.getElementById('autoSubmitApplicationBtn');
  const markSubmittedBtn = document.getElementById('markSubmittedBtn');

  // ── Jamaica Workforce Accelerator handoff ─────────────────────────────────
  (function handleJamaicaHandoff() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') !== 'jamaica') return;

    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('rr_rocket_pending') || 'null'); } catch { /* ignore */ }
    localStorage.removeItem('rr_rocket_pending');

    const role = params.get('role') || (pending && pending.title) || '';
    if (role && roleInput) roleInput.value = role;

    if (pending && pending.link && queueInput) {
      queueInput.value = pending.link;
    } else if (role && queueInput) {
      queueInput.value = role;
    }

    // Show welcome banner
    const banner = document.createElement('div');
    banner.style.cssText = 'background:linear-gradient(135deg,#7c3aed22,#2563eb22);border:1px solid #7c3aed55;border-radius:10px;padding:14px 18px;margin-bottom:18px;color:#e2e8f0;font-size:.9rem;line-height:1.5;';
    banner.innerHTML = `<strong style="color:#a78bfa;">🚀 Handoff from Jamaica Workforce Accelerator</strong><br>
      ${pending ? `<strong>${pending.title}</strong> at <strong>${pending.company}</strong> (${pending.location}) is pre-loaded below.` : `Role "<strong>${role}</strong>" is pre-loaded below.`}
      Review and click <strong>Queue Applications</strong> to add it to your 1-Click Apply Queue pipeline.`;
    const heroEl = document.querySelector('.queue-hero, .page-hero, h1, #applyQueueResult');
    if (heroEl && heroEl.parentNode) {
      heroEl.parentNode.insertBefore(banner, heroEl.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }

    // Show AI tailor panel when arriving from Jamaica
    const aiTailorPanel = document.getElementById('aiTailorPanel');
    if (aiTailorPanel) aiTailorPanel.style.display = 'block';
  })();

  // ── AI Auto-Tailor (1-Click Apply Queue) ─────────────────────────────────────────
  (function initAiTailor() {
    const tailorBtn = document.getElementById('aiTailorBtn');
    const statusEl  = document.getElementById('aiTailorStatus');
    const resultEl  = document.getElementById('aiTailorResult');
    if (!tailorBtn) return;

    tailorBtn.addEventListener('click', async () => {
      const jobTitle   = (document.getElementById('applyRole')?.value || '').trim();
      const jobDesc    = (document.getElementById('aiTailorJobDesc')?.value || '').trim();
      const resumeText = (document.getElementById('aiTailorResume')?.value || '').trim();

      if (!jobDesc) { if (statusEl) statusEl.textContent = 'Please paste the job description above.'; return; }

      tailorBtn.disabled = true;
      tailorBtn.textContent = '⏳ Tailoring…';
      if (statusEl) statusEl.textContent = 'AI is reading the job and tailoring your application…';
      if (resultEl) resultEl.innerHTML = '';

      try {
        const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
        const res = await fetch(typeof apiUrl === 'function' ? apiUrl('/api/apply/ai-tailor') : '/api/apply/ai-tailor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ jobTitle, jobDescription: jobDesc, resumeText })
        });
        const data = await res.json();
        if (!res.ok) { if (statusEl) statusEl.textContent = data.error || 'Tailor failed.'; tailorBtn.disabled = false; tailorBtn.textContent = '✨ Generate Tailored Bullets + Cover Letter'; return; }

        const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        if (resultEl) resultEl.innerHTML = `
          <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:14px;border:1px solid #334155;">
            <p style="color:#c4b5fd;font-weight:700;margin:0 0 8px;font-size:.9rem;">📋 Tailored Resume Bullets</p>
            <pre style="white-space:pre-wrap;color:#e2e8f0;font-family:inherit;font-size:.86rem;margin:0;">${esc(data.bullets)}</pre>
          </div>
          <div style="background:#0f172a;border-radius:10px;padding:16px;border:1px solid #334155;">
            <p style="color:#c4b5fd;font-weight:700;margin:0 0 8px;font-size:.9rem;">✉️ Cover Letter Paragraph</p>
            <pre style="white-space:pre-wrap;color:#e2e8f0;font-family:inherit;font-size:.86rem;margin:0;">${esc(data.coverLetter)}</pre>
          </div>
          <button onclick="navigator.clipboard.writeText(${JSON.stringify((data.bullets || '') + '\n\n---\n\n' + (data.coverLetter || ''))}).then(()=>this.textContent='✅ Copied!')" type="button" style="margin-top:12px;padding:8px 18px;border-radius:8px;border:none;background:#334155;color:#fff;cursor:pointer;font-size:.85rem;">📋 Copy All</button>`;
        if (statusEl) statusEl.textContent = 'Done! Copy the content above and customize as needed.';
      } catch (err) {
        if (statusEl) statusEl.textContent = 'Network error. Please try again.';
      } finally {
        tailorBtn.disabled = false;
        tailorBtn.textContent = '✨ Generate Tailored Bullets + Cover Letter';
      }
    });
  })();


  let autopilotSettings = {
    mode: 'manual',
    maxDailyApplications: 5,
    excludedCompanies: [],
    requireApprovalForTopJobs: true,
    topJobMatchThreshold: 85
  };
  let currentJobs = [];
  let selectedJob = null;
  let latestResumeText = '';

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

  function compactDisplayText(value, fallback, maxLen) {
    const markerRegex = /(skip to main content|this button displays|jobs people learning|clear text|join or sign in|privacy policy|cookie policy|forgot password|get notified when a new job is posted|by clicking continue)/i;
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return fallback;

    let cleaned = text;
    const markerMatch = cleaned.match(markerRegex);
    if (markerMatch && Number.isInteger(markerMatch.index) && markerMatch.index > 0) {
      cleaned = cleaned.slice(0, markerMatch.index).trim();
    }

    if (maxLen > 0 && cleaned.length > maxLen) {
      cleaned = cleaned.slice(0, maxLen).replace(/\s+\S*$/, '').trim() + '...';
    }

    return cleaned || fallback;
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

  function setGuidedStatus(message, color) {
    if (!guidedApplyStatus) return;
    guidedApplyStatus.textContent = message || '';
    guidedApplyStatus.style.color = color || '#cbd5e1';
  }

  function checklistToText(items) {
    return (Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean).join('\n');
  }

  function checklistFromText(text) {
    return String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 8);
  }

  function selectJob(job) {
    selectedJob = job || null;
    if (!selectedJob) {
      if (selectedJobSummary) selectedJobSummary.textContent = 'Select a queued/top-match job to start guided apply.';
      return;
    }

    const title = compactDisplayText(selectedJob.title, 'Untitled job', 90);
    const company = compactDisplayText(selectedJob.company, 'Unknown company', 70);
    const score = Number(selectedJob.matchScore || 0);
    if (selectedJobSummary) {
      selectedJobSummary.innerHTML = `<strong>${escapeHtml(title)}</strong> @ <strong>${escapeHtml(company)}</strong> · Match ${escapeHtml(score)}`;
    }
    if (workflowJobDescription && !String(workflowJobDescription.value || '').trim()) {
      workflowJobDescription.value = String(selectedJob.description || '').trim();
    }
    setGuidedStatus('Selected job. Generate tailored drafts and fit checklist next.', '#2563eb');
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
      currentJobs = jobs;

      if (!visibleJobs.length) {
        renderEmptyState(queuedJobsList, 'No queued jobs yet. Add roles or job links above to build your ready queue.');
        return;
      }

      queuedJobsList.innerHTML = visibleJobs.map((job) => {
        const jobId = escapeHtml(job._id);
        const title = escapeHtml(compactDisplayText(job.title, 'Untitled job', 85));
        const company = escapeHtml(compactDisplayText(job.company, 'Unknown company', 70));
        const status = escapeHtml(job.status || 'saved');
        const link = job.link ? `<a href="${escapeHtml(job.link)}" target="_blank" rel="noopener noreferrer">Open posting</a>` : 'Manual entry';
        const readyButton = status === 'ready'
          ? ''
          : `<button type="button" class="tool-action-btn--secondary" data-action="ready" data-job-id="${jobId}">Mark Ready</button>`;
        const appliedButton = status === 'applied'
          ? ''
          : `<button type="button" class="tool-action-btn--secondary" data-action="applied" data-job-id="${jobId}">Mark Applied</button>`;
        const selectButton = `<button type="button" class="tool-action-btn--secondary" data-action="select" data-job-id="${jobId}">Select</button>`;

        return `
          <article class="queue-job-card">
            <div class="queue-job-header">
              <h3 class="queue-job-title">${title}</h3>
              <span class="queue-status-chip">${status}</span>
            </div>
            <p class="queue-job-meta"><strong>${company}</strong><br>${link}</p>
            <div class="queue-job-actions">
              ${selectButton}
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
            <h3 class="queue-match-title">${escapeHtml(compactDisplayText(job.title, 'Untitled job', 85))}</h3>
            <span class="queue-status-chip">${escapeHtml(job.urgencyLabel || 'Ready')}</span>
          </div>
          <p class="queue-match-meta"><strong>${escapeHtml(compactDisplayText(job.company, 'Unknown company', 70))}</strong><br>Match score: ${escapeHtml(job.matchScore || 0)}</p>
          <div class="queue-job-actions">
            <button type="button" class="tool-action-btn--secondary" data-action="select" data-job-id="${escapeHtml(job.id || '')}" data-job-title="${escapeHtml(job.title || '')}" data-job-company="${escapeHtml(job.company || '')}" data-job-link="${escapeHtml(job.link || '')}" data-job-description="${escapeHtml(job.description || '')}" data-job-match="${escapeHtml(job.matchScore || 0)}">Select</button>
          </div>
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

  async function generateGuidedDrafts() {
    if (!selectedJob) {
      setGuidedStatus('Select a job first.', '#dc2626');
      return;
    }

    const jobDescription = String(workflowJobDescription?.value || selectedJob.description || '').trim();
    if (!jobDescription) {
      setGuidedStatus('Add or paste a job description before generating drafts.', '#dc2626');
      return;
    }

    const aiResumeInput = document.getElementById('aiTailorResume');
    latestResumeText = String(aiResumeInput?.value || latestResumeText || '').trim();

    generateGuidedApplyBtn.disabled = true;
    setGuidedStatus('Generating tailored resume bullets, cover draft, and fit checklist...', '#475569');

    try {
      const payload = {
        jobTitle: selectedJob.title || roleInput?.value || '',
        jobDescription,
        resumeText: latestResumeText
      };
      const response = await fetch(buildApiUrl('/api/apply/ai-tailor'), {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate tailored drafts.');

      if (workflowResumeDraft) workflowResumeDraft.value = String(data.resumeDraft || data.bullets || '').trim();
      if (workflowCoverDraft) workflowCoverDraft.value = String(data.coverLetterDraft || data.coverLetter || '').trim();
      if (workflowFitScore) workflowFitScore.value = String(Number(data.fitScore || 0) || '');
      if (workflowChecklist) workflowChecklist.value = checklistToText(data.fitChecklist || []);

      setGuidedStatus('Drafts generated. Review/edit then save to this job.', '#16a34a');
    } catch (error) {
      setGuidedStatus(error.message || 'Could not generate drafts right now.', '#dc2626');
    } finally {
      generateGuidedApplyBtn.disabled = false;
    }
  }

  async function saveGuidedDrafts() {
    if (!selectedJob || !selectedJob._id) {
      setGuidedStatus('Select a saved job from queue or top matches before saving.', '#dc2626');
      return;
    }

    saveGuidedApplyBtn.disabled = true;
    setGuidedStatus('Saving guided apply drafts to this job...', '#475569');
    try {
      const payload = {
        resumeDraft: String(workflowResumeDraft?.value || '').trim(),
        coverLetterDraft: String(workflowCoverDraft?.value || '').trim(),
        fitScore: Number(workflowFitScore?.value || 0),
        fitChecklist: checklistFromText(workflowChecklist?.value || '')
      };

      const response = await fetch(buildApiUrl(`/api/jobs/${selectedJob._id}/materials`), {
        method: 'PUT',
        headers: getHeaders(true),
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save guided drafts.');

      await loadQueue();
      await loadTopMatches();
      setGuidedStatus('Drafts saved. You can now open the page or auto-submit (if integrated).', '#16a34a');
    } catch (error) {
      setGuidedStatus(error.message || 'Could not save drafts.', '#dc2626');
    } finally {
      saveGuidedApplyBtn.disabled = false;
    }
  }

  async function executeGuidedApply(mode) {
    if (!selectedJob || !selectedJob._id) {
      setGuidedStatus('Select a job first.', '#dc2626');
      return;
    }

    const isAuto = mode === 'auto-submit';
    if (isAuto) {
      autoSubmitApplicationBtn.disabled = true;
    } else {
      openApplicationBtn.disabled = true;
    }

    setGuidedStatus(isAuto ? 'Trying auto-submit via integration...' : 'Preparing application page...', '#475569');
    try {
      const response = await fetch(buildApiUrl('/api/apply/execute'), {
        method: 'POST',
        headers: getHeaders(true),
        body: JSON.stringify({ jobId: selectedJob._id, mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not execute apply workflow.');

      if (data.link && data.action === 'opened') {
        window.open(String(data.link), '_blank', 'noopener,noreferrer');
      }

      await loadQueue();
      await loadTopMatches();
      setGuidedStatus(String(data.message || 'Apply step completed.'), '#16a34a');
      setMessage(String(data.message || 'Apply step completed.'), '#16a34a');
    } catch (error) {
      setGuidedStatus(error.message || 'Could not execute apply workflow.', '#dc2626');
    } finally {
      openApplicationBtn.disabled = false;
      autoSubmitApplicationBtn.disabled = false;
    }
  }

  async function markSelectedSubmitted() {
    if (!selectedJob || !selectedJob._id) {
      setGuidedStatus('Select a job first.', '#dc2626');
      return;
    }
    markSubmittedBtn.disabled = true;
    try {
      await updateJob(selectedJob._id, 'applied');
      setGuidedStatus('Status updated to Applied.', '#16a34a');
    } finally {
      markSubmittedBtn.disabled = false;
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
  generateGuidedApplyBtn?.addEventListener('click', generateGuidedDrafts);
  saveGuidedApplyBtn?.addEventListener('click', saveGuidedDrafts);
  openApplicationBtn?.addEventListener('click', function () { executeGuidedApply('open'); });
  autoSubmitApplicationBtn?.addEventListener('click', function () { executeGuidedApply('auto-submit'); });
  markSubmittedBtn?.addEventListener('click', markSelectedSubmitted);

  queuedJobsList?.addEventListener('click', async function (event) {
    const button = event.target.closest('button[data-job-id][data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    const jobId = button.getAttribute('data-job-id');
    if (action === 'select') {
      const job = currentJobs.find((item) => String(item._id) === String(jobId));
      if (job) selectJob(job);
      return;
    }
    await updateJob(jobId, action);
  });

  recommendationsList?.addEventListener('click', function (event) {
    const button = event.target.closest('button[data-action="select"]');
    if (!button) return;

    const jobId = String(button.getAttribute('data-job-id') || '').trim();
    const existing = currentJobs.find((job) => String(job._id) === jobId);
    if (existing) {
      selectJob(existing);
      return;
    }

    selectJob({
      _id: jobId,
      title: button.getAttribute('data-job-title') || '',
      company: button.getAttribute('data-job-company') || '',
      link: button.getAttribute('data-job-link') || '',
      description: button.getAttribute('data-job-description') || '',
      matchScore: Number(button.getAttribute('data-job-match') || 0),
      status: 'ready'
    });
  });

  loadQueue();
  loadTopMatches();
  loadAutopilotSettings();
  appendAutopilotSettingsButton();
});