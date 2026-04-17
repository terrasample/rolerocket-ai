(function () {
  if (typeof apiUrl !== 'function' || typeof getStoredToken !== 'function') return;

  const WORK_MODE_OPTIONS = ['remote', 'hybrid', 'onsite'];
  const EMPLOYMENT_TYPE_OPTIONS = ['full-time', 'contract', 'part-time', 'temporary', 'internship'];
  const SENIORITY_OPTIONS = ['internship', 'entry', 'associate', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'];
  const FREQUENCY_OPTIONS = ['instant', 'daily', 'weekly'];

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function titleize(value) {
    return String(value || '')
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function splitLines(value) {
    return String(value || '')
      .split(/[\n,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function summarizeResume(source, label, text) {
    if (source === 'none' || !text) return 'No resume attached. Matching will use titles and filters only.';
    const preview = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const prefix = source === 'dashboard' ? 'Imported from dashboard resume' : `Uploaded resume${label ? `: ${label}` : ''}`;
    return `${prefix}. ${preview}${preview.length >= 120 ? '...' : ''}`;
  }

  function formatDateTime(value) {
    if (!value) return 'Not run yet';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not run yet';
    return parsed.toLocaleString();
  }

  async function api(path, options = {}) {
    const token = getStoredToken();
    if (!token) throw new Error('Please log in again.');

    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(apiUrl(path), { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function renderCheckboxGroup(name, options, selected) {
    return options.map((option) => {
      const checked = selected.includes(option) ? 'checked' : '';
      return `
        <label class="job-alerts-check">
          <input type="checkbox" name="${name}" value="${option}" ${checked} />
          <span>${escapeHtml(titleize(option))}</span>
        </label>
      `;
    }).join('');
  }

  function renderTextareaList(value) {
    return escapeHtml((value || []).join('\n'));
  }

  function createDefaultFormState(defaults) {
    return {
      name: '',
      titles: ['', '', ''],
      location: defaults.location || 'Remote',
      frequency: defaults.frequency || 'daily',
      workModes: Array.isArray(defaults.workModes) ? defaults.workModes : ['remote'],
      employmentTypes: Array.isArray(defaults.employmentTypes) ? defaults.employmentTypes : ['full-time'],
      seniorityLevels: Array.isArray(defaults.seniorityLevels) ? defaults.seniorityLevels : [],
      industries: Array.isArray(defaults.industries) ? defaults.industries : [],
      includeKeywords: Array.isArray(defaults.includeKeywords) ? defaults.includeKeywords : [],
      excludeKeywords: Array.isArray(defaults.excludeKeywords) ? defaults.excludeKeywords : [],
      excludedCompanies: Array.isArray(defaults.excludedCompanies) ? defaults.excludedCompanies : [],
      salaryMin: defaults.salaryMin || '',
      emailEnabled: defaults.emailEnabled !== false,
      inAppEnabled: defaults.inAppEnabled !== false,
      includeSimilarTitles: defaults.includeSimilarTitles !== false,
      resumeSource: 'none',
      resumeText: '',
      resumeLabel: ''
    };
  }

  function collectChecked(root, name) {
    return Array.from(root.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
  }

  function dashboardTemplate(state) {
    const form = state.form;
    const editingLabel = state.editingId ? 'Edit alert profile' : 'Create alert profile';
    return `
      <div class="job-alerts-shell">
        <div class="job-alerts-heading-row">
          <div>
            <h3 class="job-alerts-title">🔔 Job Alerts</h3>
            <p class="job-alerts-subtitle">Create persistent alert profiles, import your latest resume, scan for matches, and save top roles straight into your pipeline.</p>
          </div>
          <div class="job-alerts-kicker">Dashboard control center</div>
        </div>

        <div class="job-alerts-panel">
          <div class="job-alerts-panel-head">
            <h4>${editingLabel}</h4>
            <div class="job-alerts-panel-note">Up to 3 target titles per alert profile</div>
          </div>

          <div class="job-alerts-grid">
            <label class="job-alerts-field">
              <span>Alert Name</span>
              <input id="ja-name" type="text" value="${escapeHtml(form.name)}" placeholder="Project roles - East Coast" />
            </label>
            <label class="job-alerts-field">
              <span>Location</span>
              <input id="ja-location" type="text" value="${escapeHtml(form.location)}" placeholder="Remote, New York, Atlanta..." />
            </label>
            <label class="job-alerts-field">
              <span>Job Title 1</span>
              <input id="ja-title-1" type="text" value="${escapeHtml(form.titles[0])}" placeholder="Project Manager" />
            </label>
            <label class="job-alerts-field">
              <span>Job Title 2</span>
              <input id="ja-title-2" type="text" value="${escapeHtml(form.titles[1])}" placeholder="Program Manager" />
            </label>
            <label class="job-alerts-field">
              <span>Job Title 3</span>
              <input id="ja-title-3" type="text" value="${escapeHtml(form.titles[2])}" placeholder="Implementation Manager" />
            </label>
            <label class="job-alerts-field">
              <span>Alert Frequency</span>
              <select id="ja-frequency">${FREQUENCY_OPTIONS.map((option) => `<option value="${option}" ${form.frequency === option ? 'selected' : ''}>${titleize(option)}</option>`).join('')}</select>
            </label>
            <label class="job-alerts-field">
              <span>Salary Minimum</span>
              <input id="ja-salary-min" type="number" min="0" step="1000" value="${escapeHtml(form.salaryMin)}" placeholder="Optional" />
            </label>
          </div>

          <div class="job-alerts-row-grid">
            <div class="job-alerts-field-block">
              <span class="job-alerts-field-label">Work Mode</span>
              <div class="job-alerts-check-grid">${renderCheckboxGroup('ja-workmode', WORK_MODE_OPTIONS, form.workModes)}</div>
            </div>
            <div class="job-alerts-field-block">
              <span class="job-alerts-field-label">Employment Type</span>
              <div class="job-alerts-check-grid">${renderCheckboxGroup('ja-employment', EMPLOYMENT_TYPE_OPTIONS, form.employmentTypes)}</div>
            </div>
            <div class="job-alerts-field-block">
              <span class="job-alerts-field-label">Seniority</span>
              <div class="job-alerts-check-grid">${renderCheckboxGroup('ja-seniority', SENIORITY_OPTIONS, form.seniorityLevels)}</div>
            </div>
          </div>

          <div class="job-alerts-grid job-alerts-grid--textareas">
            <label class="job-alerts-field">
              <span>Industries</span>
              <textarea id="ja-industries" rows="3" placeholder="Technology&#10;Healthcare&#10;Finance">${renderTextareaList(form.industries)}</textarea>
            </label>
            <label class="job-alerts-field">
              <span>Include Keywords</span>
              <textarea id="ja-include-keywords" rows="3" placeholder="Agile&#10;Stakeholder management&#10;Implementation">${renderTextareaList(form.includeKeywords)}</textarea>
            </label>
            <label class="job-alerts-field">
              <span>Exclude Keywords</span>
              <textarea id="ja-exclude-keywords" rows="3" placeholder="Commission&#10;Door-to-door">${renderTextareaList(form.excludeKeywords)}</textarea>
            </label>
            <label class="job-alerts-field">
              <span>Excluded Companies</span>
              <textarea id="ja-excluded-companies" rows="3" placeholder="Company names to avoid">${renderTextareaList(form.excludedCompanies)}</textarea>
            </label>
          </div>

          <div class="job-alerts-row-grid">
            <label class="job-alerts-check"><input id="ja-email-enabled" type="checkbox" ${form.emailEnabled ? 'checked' : ''} /><span>Email alert summaries</span></label>
            <label class="job-alerts-check"><input id="ja-inapp-enabled" type="checkbox" ${form.inAppEnabled ? 'checked' : ''} /><span>Keep in-app matches on dashboard</span></label>
            <label class="job-alerts-check"><input id="ja-include-similar" type="checkbox" ${form.includeSimilarTitles ? 'checked' : ''} /><span>Include similar titles</span></label>
          </div>

          <div class="job-alerts-resume-box">
            <div>
              <strong>Resume for matching</strong>
              <div class="job-alerts-resume-copy">${escapeHtml(summarizeResume(form.resumeSource, form.resumeLabel, form.resumeText))}</div>
            </div>
            <div class="job-alerts-toolbar">
              <button type="button" class="secondary-btn" data-action="import-dashboard-resume">Import from Dashboard</button>
              <button type="button" class="secondary-btn" data-action="upload-alert-resume">Upload Latest Resume</button>
              <button type="button" class="secondary-btn" data-action="clear-alert-resume">Use Without Resume</button>
              <input id="ja-resume-upload" type="file" accept=".txt,.pdf,.doc,.docx" hidden />
            </div>
          </div>

          <div class="job-alerts-recommendations">
            <strong>Recommended titles from your saved resume</strong>
            <div class="job-alerts-pill-row">
              ${state.recommendations.length ? state.recommendations.map((title) => `<button type="button" class="job-alerts-pill" data-recommendation="${escapeHtml(title)}">${escapeHtml(title)}</button>`).join('') : '<span class="job-alerts-muted">Save a resume to unlock title suggestions.</span>'}
            </div>
          </div>

          <div class="job-alerts-toolbar job-alerts-toolbar--primary">
            <button type="button" class="auth-submit-btn" data-action="save-alert">${state.editingId ? 'Update Alert' : 'Save Alert'}</button>
            <button type="button" class="secondary-btn" data-action="save-run-alert">${state.editingId ? 'Update & Run Scan' : 'Save & Run Scan'}</button>
            <button type="button" class="secondary-btn" data-action="reset-alert-form">Reset Form</button>
          </div>
          <div class="job-alerts-status ${state.messageType || ''}">${escapeHtml(state.message || '')}</div>
        </div>

        <div class="job-alerts-list">
          ${state.alerts.length ? state.alerts.map((alert) => `
            <article class="job-alert-card ${alert.isPaused ? 'is-paused' : ''}">
              <div class="job-alert-card__head">
                <div>
                  <h4>${escapeHtml(alert.name)}</h4>
                  <div class="job-alert-card__meta">${escapeHtml((alert.titles || []).join(' • '))} · ${escapeHtml(alert.location || 'Remote')} · ${escapeHtml(titleize(alert.frequency || 'daily'))}</div>
                </div>
                <div class="job-alert-badge-row">
                  <span class="job-alert-badge">${alert.isPaused ? 'Paused' : 'Active'}</span>
                  <span class="job-alert-badge">${Number(alert.lastMatchCount || 0)} matches</span>
                  <span class="job-alert-badge">${Number(alert.newJobsFoundCount || 0)} new</span>
                </div>
              </div>
              <div class="job-alert-card__stats">
                <span><strong>Last checked:</strong> ${escapeHtml(formatDateTime(alert.lastCheckedAt))}</span>
                <span><strong>Next run:</strong> ${escapeHtml(formatDateTime(alert.nextRunAt))}</span>
                <span><strong>Total runs:</strong> ${Number(alert.totalRuns || 0)}</span>
                <span><strong>Resume:</strong> ${escapeHtml(alert.resumeSource || 'none')}</span>
              </div>
              <div class="job-alert-actions">
                <button type="button" class="secondary-btn" data-action="edit-alert" data-alert-id="${alert._id}">Edit</button>
                <button type="button" class="secondary-btn" data-action="run-alert" data-alert-id="${alert._id}">Run Scan</button>
                <button type="button" class="secondary-btn" data-action="toggle-alert" data-alert-id="${alert._id}" data-paused="${alert.isPaused ? '1' : '0'}">${alert.isPaused ? 'Resume Alert' : 'Pause Alert'}</button>
                <button type="button" class="secondary-btn" data-action="delete-alert" data-alert-id="${alert._id}">Delete</button>
              </div>
              ${(alert.latestResults || []).length ? `
                <div class="job-alert-results">
                  ${(alert.latestResults || []).map((result) => `
                    <div class="job-alert-result">
                      <div class="job-alert-result__top">
                        <div>
                          <strong>${escapeHtml(result.title)}</strong>
                          <div class="job-alert-result__meta">${escapeHtml(result.company)} · ${escapeHtml(result.location)} · ${escapeHtml(result.source || 'Source unknown')}</div>
                        </div>
                        <span class="job-alert-score">${Number(result.matchScore || 0)}%</span>
                      </div>
                      <div class="job-alert-result__why">${(result.whyMatched || []).map((reason) => `<span class="job-alert-result__reason">${escapeHtml(reason)}</span>`).join('')}</div>
                      <div class="job-alert-actions">
                        <a class="secondary-btn job-alert-link-btn" href="${escapeHtml(result.link || '#')}" target="_blank" rel="noopener noreferrer">Open Job</a>
                        <button type="button" class="secondary-btn" data-action="save-match" data-alert-id="${alert._id}" data-fingerprint="${escapeHtml(result.fingerprint || '')}">Save to Pipeline</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : '<div class="job-alert-empty">No in-app results yet. Run a scan to populate matches.</div>'}
            </article>
          `).join('') : '<div class="job-alert-empty">No alert profiles yet. Create your first profile above.</div>'}
        </div>
      </div>
    `;
  }

  function accountTemplate(state) {
    const defaults = state.defaults;
    return `
      <div class="job-alerts-shell">
        <div class="job-alerts-heading-row">
          <div>
            <h3 class="job-alerts-title">🔧 Job Alert Defaults</h3>
            <p class="job-alerts-subtitle">These preferences prefill new alert profiles in your dashboard.</p>
          </div>
          <div class="job-alerts-kicker">Account-level defaults</div>
        </div>
        <div class="job-alerts-grid">
          <label class="job-alerts-field">
            <span>Default Location</span>
            <input id="jad-location" type="text" value="${escapeHtml(defaults.location || 'Remote')}" placeholder="Remote" />
          </label>
          <label class="job-alerts-field">
            <span>Default Frequency</span>
            <select id="jad-frequency">${FREQUENCY_OPTIONS.map((option) => `<option value="${option}" ${defaults.frequency === option ? 'selected' : ''}>${titleize(option)}</option>`).join('')}</select>
          </label>
          <label class="job-alerts-field">
            <span>Default Salary Minimum</span>
            <input id="jad-salary-min" type="number" min="0" step="1000" value="${escapeHtml(defaults.salaryMin || '')}" placeholder="Optional" />
          </label>
        </div>
        <div class="job-alerts-row-grid">
          <div class="job-alerts-field-block">
            <span class="job-alerts-field-label">Default Work Modes</span>
            <div class="job-alerts-check-grid">${renderCheckboxGroup('jad-workmode', WORK_MODE_OPTIONS, defaults.workModes || [])}</div>
          </div>
          <div class="job-alerts-field-block">
            <span class="job-alerts-field-label">Default Employment Types</span>
            <div class="job-alerts-check-grid">${renderCheckboxGroup('jad-employment', EMPLOYMENT_TYPE_OPTIONS, defaults.employmentTypes || [])}</div>
          </div>
          <div class="job-alerts-field-block">
            <span class="job-alerts-field-label">Default Seniority</span>
            <div class="job-alerts-check-grid">${renderCheckboxGroup('jad-seniority', SENIORITY_OPTIONS, defaults.seniorityLevels || [])}</div>
          </div>
        </div>
        <div class="job-alerts-grid job-alerts-grid--textareas">
          <label class="job-alerts-field">
            <span>Default Industries</span>
            <textarea id="jad-industries" rows="3">${renderTextareaList(defaults.industries || [])}</textarea>
          </label>
          <label class="job-alerts-field">
            <span>Default Include Keywords</span>
            <textarea id="jad-include-keywords" rows="3">${renderTextareaList(defaults.includeKeywords || [])}</textarea>
          </label>
          <label class="job-alerts-field">
            <span>Default Exclude Keywords</span>
            <textarea id="jad-exclude-keywords" rows="3">${renderTextareaList(defaults.excludeKeywords || [])}</textarea>
          </label>
          <label class="job-alerts-field">
            <span>Default Excluded Companies</span>
            <textarea id="jad-excluded-companies" rows="3">${renderTextareaList(defaults.excludedCompanies || [])}</textarea>
          </label>
        </div>
        <div class="job-alerts-row-grid">
          <label class="job-alerts-check"><input id="jad-email-enabled" type="checkbox" ${defaults.emailEnabled !== false ? 'checked' : ''} /><span>Email summaries by default</span></label>
          <label class="job-alerts-check"><input id="jad-inapp-enabled" type="checkbox" ${defaults.inAppEnabled !== false ? 'checked' : ''} /><span>Keep dashboard matches by default</span></label>
          <label class="job-alerts-check"><input id="jad-include-similar" type="checkbox" ${defaults.includeSimilarTitles !== false ? 'checked' : ''} /><span>Expand similar titles by default</span></label>
        </div>
        <div class="job-alerts-toolbar job-alerts-toolbar--primary">
          <button type="button" class="auth-submit-btn" data-action="save-defaults">Save Defaults</button>
        </div>
        <div class="job-alerts-status ${state.messageType || ''}">${escapeHtml(state.message || '')}</div>
      </div>
    `;
  }

  async function initDashboardApp(root) {
    const state = {
      defaults: {},
      alerts: [],
      recommendations: [],
      editingId: '',
      message: '',
      messageType: '',
      form: createDefaultFormState({})
    };

    async function loadState() {
      const [defaultsData, alertsData, recsData] = await Promise.all([
        api('/api/job-alerts/defaults', { method: 'GET' }),
        api('/api/job-alerts', { method: 'GET' }),
        api('/api/job-alerts/recommendations', { method: 'GET' })
      ]);
      state.defaults = defaultsData.defaults || {};
      state.alerts = alertsData.alerts || [];
      state.recommendations = recsData.titles || [];
      if (!state.editingId) state.form = createDefaultFormState(state.defaults);
    }

    function render() {
      root.innerHTML = dashboardTemplate(state);
      bindEvents();
    }

    function collectForm() {
      return {
        name: root.querySelector('#ja-name')?.value || '',
        titles: [
          root.querySelector('#ja-title-1')?.value || '',
          root.querySelector('#ja-title-2')?.value || '',
          root.querySelector('#ja-title-3')?.value || ''
        ],
        location: root.querySelector('#ja-location')?.value || '',
        frequency: root.querySelector('#ja-frequency')?.value || 'daily',
        salaryMin: root.querySelector('#ja-salary-min')?.value || '',
        workModes: collectChecked(root, 'ja-workmode'),
        employmentTypes: collectChecked(root, 'ja-employment'),
        seniorityLevels: collectChecked(root, 'ja-seniority'),
        industries: splitLines(root.querySelector('#ja-industries')?.value || ''),
        includeKeywords: splitLines(root.querySelector('#ja-include-keywords')?.value || ''),
        excludeKeywords: splitLines(root.querySelector('#ja-exclude-keywords')?.value || ''),
        excludedCompanies: splitLines(root.querySelector('#ja-excluded-companies')?.value || ''),
        emailEnabled: Boolean(root.querySelector('#ja-email-enabled')?.checked),
        inAppEnabled: Boolean(root.querySelector('#ja-inapp-enabled')?.checked),
        includeSimilarTitles: Boolean(root.querySelector('#ja-include-similar')?.checked),
        resumeSource: state.form.resumeSource,
        resumeText: state.form.resumeText,
        resumeLabel: state.form.resumeLabel
      };
    }

    async function saveAlertAndMaybeRun(runAfterSave) {
      const payload = collectForm();
      const endpoint = state.editingId ? `/api/job-alerts/${state.editingId}` : '/api/job-alerts';
      const method = state.editingId ? 'PUT' : 'POST';
      const data = await api(endpoint, { method, body: JSON.stringify(payload) });
      let alert = data.alert;

      if (runAfterSave && alert?._id) {
        const runData = await api(`/api/job-alerts/${alert._id}/run`, { method: 'POST' });
        alert = runData.alert;
      }

      state.message = runAfterSave ? 'Alert saved and scan completed.' : 'Alert saved.';
      state.messageType = 'success';
      state.editingId = '';
      await loadState();
      render();
    }

    async function importDashboardResume() {
      const data = await api('/api/resume/latest', { method: 'GET' });
      const content = String(data.resume?.content || '').trim();
      if (!content) throw new Error('No dashboard resume found yet. Save one first.');
      state.form.resumeSource = 'dashboard';
      state.form.resumeText = content;
      state.form.resumeLabel = data.resume?.title || 'Dashboard Resume';
      state.message = 'Imported latest dashboard resume for alert matching.';
      state.messageType = 'success';
      render();
    }

    async function uploadAlertResume(file) {
      const formData = new FormData();
      formData.append('resumeFile', file);
      const data = await api('/api/resume/upload', { method: 'POST', body: formData });
      state.form.resumeSource = 'upload';
      state.form.resumeText = String(data.content || '').trim();
      state.form.resumeLabel = file.name || 'Uploaded Resume';
      state.message = 'Uploaded resume saved and attached to this alert.';
      state.messageType = 'success';
      render();
    }

    function bindEvents() {
      root.querySelector('[data-action="save-alert"]')?.addEventListener('click', async () => {
        try {
          await saveAlertAndMaybeRun(false);
        } catch (err) {
          state.message = err.message;
          state.messageType = 'error';
          render();
        }
      });

      root.querySelector('[data-action="save-run-alert"]')?.addEventListener('click', async () => {
        try {
          await saveAlertAndMaybeRun(true);
        } catch (err) {
          state.message = err.message;
          state.messageType = 'error';
          render();
        }
      });

      root.querySelector('[data-action="reset-alert-form"]')?.addEventListener('click', () => {
        state.editingId = '';
        state.form = createDefaultFormState(state.defaults);
        state.message = 'Alert form reset.';
        state.messageType = 'info';
        render();
      });

      root.querySelector('[data-action="import-dashboard-resume"]')?.addEventListener('click', async () => {
        try {
          await importDashboardResume();
        } catch (err) {
          state.message = err.message;
          state.messageType = 'error';
          render();
        }
      });

      root.querySelector('[data-action="upload-alert-resume"]')?.addEventListener('click', () => {
        root.querySelector('#ja-resume-upload')?.click();
      });

      root.querySelector('[data-action="clear-alert-resume"]')?.addEventListener('click', () => {
        state.form.resumeSource = 'none';
        state.form.resumeText = '';
        state.form.resumeLabel = '';
        state.message = 'Resume removed from this alert profile.';
        state.messageType = 'info';
        render();
      });

      root.querySelector('#ja-resume-upload')?.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
        if (!file) return;
        try {
          await uploadAlertResume(file);
        } catch (err) {
          state.message = err.message;
          state.messageType = 'error';
          render();
        }
      });

      root.querySelectorAll('[data-recommendation]').forEach((button) => {
        button.addEventListener('click', () => {
          const title = button.getAttribute('data-recommendation') || '';
          const nextTitles = [...state.form.titles];
          const emptyIndex = nextTitles.findIndex((item) => !String(item || '').trim());
          const targetIndex = emptyIndex >= 0 ? emptyIndex : 0;
          nextTitles[targetIndex] = title;
          state.form.titles = nextTitles;
          render();
        });
      });

      root.querySelectorAll('[data-action="edit-alert"]').forEach((button) => {
        button.addEventListener('click', () => {
          const alert = state.alerts.find((item) => item._id === button.getAttribute('data-alert-id'));
          if (!alert) return;
          state.editingId = alert._id;
          state.form = {
            name: alert.name || '',
            titles: [...(alert.titles || []), '', '', ''].slice(0, 3),
            location: alert.location || 'Remote',
            frequency: alert.frequency || 'daily',
            workModes: alert.workModes || [],
            employmentTypes: alert.employmentTypes || [],
            seniorityLevels: alert.seniorityLevels || [],
            industries: alert.industries || [],
            includeKeywords: alert.includeKeywords || [],
            excludeKeywords: alert.excludeKeywords || [],
            excludedCompanies: alert.excludedCompanies || [],
            salaryMin: alert.salaryMin || '',
            emailEnabled: alert.emailEnabled !== false,
            inAppEnabled: alert.inAppEnabled !== false,
            includeSimilarTitles: alert.includeSimilarTitles !== false,
            resumeSource: alert.resumeSource || 'none',
            resumeText: alert.resumeText || '',
            resumeLabel: alert.resumeLabel || ''
          };
          state.message = `Editing ${alert.name}.`;
          state.messageType = 'info';
          render();
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      root.querySelectorAll('[data-action="run-alert"]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await api(`/api/job-alerts/${button.getAttribute('data-alert-id')}/run`, { method: 'POST' });
            await loadState();
            state.message = 'Alert scan completed.';
            state.messageType = 'success';
            render();
          } catch (err) {
            state.message = err.message;
            state.messageType = 'error';
            render();
          }
        });
      });

      root.querySelectorAll('[data-action="toggle-alert"]').forEach((button) => {
        button.addEventListener('click', async () => {
          const alert = state.alerts.find((item) => item._id === button.getAttribute('data-alert-id'));
          if (!alert) return;
          try {
            await api(`/api/job-alerts/${alert._id}`, {
              method: 'PUT',
              body: JSON.stringify({ ...alert, isPaused: !alert.isPaused })
            });
            await loadState();
            state.message = alert.isPaused ? 'Alert resumed.' : 'Alert paused.';
            state.messageType = 'success';
            render();
          } catch (err) {
            state.message = err.message;
            state.messageType = 'error';
            render();
          }
        });
      });

      root.querySelectorAll('[data-action="delete-alert"]').forEach((button) => {
        button.addEventListener('click', async () => {
          if (!window.confirm('Delete this alert profile?')) return;
          try {
            await api(`/api/job-alerts/${button.getAttribute('data-alert-id')}`, { method: 'DELETE' });
            await loadState();
            state.message = 'Alert deleted.';
            state.messageType = 'success';
            render();
          } catch (err) {
            state.message = err.message;
            state.messageType = 'error';
            render();
          }
        });
      });

      root.querySelectorAll('[data-action="save-match"]').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            const data = await api(`/api/job-alerts/${button.getAttribute('data-alert-id')}/save-match`, {
              method: 'POST',
              body: JSON.stringify({ fingerprint: button.getAttribute('data-fingerprint') })
            });
            state.message = data.alreadySaved ? 'That match is already in your pipeline.' : 'Match saved to pipeline.';
            state.messageType = 'success';
            render();
          } catch (err) {
            state.message = err.message;
            state.messageType = 'error';
            render();
          }
        });
      });
    }

    try {
      await loadState();
      render();
    } catch (err) {
      root.innerHTML = `<div class="job-alert-empty">Could not load job alerts: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function initAccountDefaultsApp(root) {
    const state = { defaults: {}, message: '', messageType: '' };

    async function loadDefaults() {
      const data = await api('/api/job-alerts/defaults', { method: 'GET' });
      state.defaults = data.defaults || {};
    }

    function render() {
      root.innerHTML = accountTemplate(state);
      root.querySelector('[data-action="save-defaults"]')?.addEventListener('click', async () => {
        try {
          const payload = {
            location: root.querySelector('#jad-location')?.value || '',
            frequency: root.querySelector('#jad-frequency')?.value || 'daily',
            salaryMin: root.querySelector('#jad-salary-min')?.value || '',
            workModes: collectChecked(root, 'jad-workmode'),
            employmentTypes: collectChecked(root, 'jad-employment'),
            seniorityLevels: collectChecked(root, 'jad-seniority'),
            industries: splitLines(root.querySelector('#jad-industries')?.value || ''),
            includeKeywords: splitLines(root.querySelector('#jad-include-keywords')?.value || ''),
            excludeKeywords: splitLines(root.querySelector('#jad-exclude-keywords')?.value || ''),
            excludedCompanies: splitLines(root.querySelector('#jad-excluded-companies')?.value || ''),
            emailEnabled: Boolean(root.querySelector('#jad-email-enabled')?.checked),
            inAppEnabled: Boolean(root.querySelector('#jad-inapp-enabled')?.checked),
            includeSimilarTitles: Boolean(root.querySelector('#jad-include-similar')?.checked)
          };
          const data = await api('/api/job-alerts/defaults', { method: 'PUT', body: JSON.stringify(payload) });
          state.defaults = data.defaults || payload;
          state.message = 'Default job-alert preferences saved.';
          state.messageType = 'success';
          render();
        } catch (err) {
          state.message = err.message;
          state.messageType = 'error';
          render();
        }
      });
    }

    try {
      await loadDefaults();
      render();
    } catch (err) {
      root.innerHTML = `<div class="job-alert-empty">Could not load alert defaults: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function init() {
    const dashboardRoot = document.getElementById('jobAlertsDashboardApp');
    const accountRoot = document.getElementById('jobAlertsAccountDefaultsApp');
    if (dashboardRoot) await initDashboardApp(dashboardRoot);
    if (accountRoot) await initAccountDefaultsApp(accountRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();