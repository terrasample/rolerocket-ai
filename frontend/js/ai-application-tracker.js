document.addEventListener('DOMContentLoaded', function () {
  const companyInput = document.getElementById('trackerCompanyInput');
  const roleInput = document.getElementById('trackerRoleInput');
  const stageInput = document.getElementById('trackerStageInput');
  const appliedDateInput = document.getElementById('trackerAppliedDateInput');
  const jobLinkInput = document.getElementById('trackerJobLinkInput');
  const notesInput = document.getElementById('trackerNotesInput');
  const focusInput = document.getElementById('trackerFocusInput');

  const addEntryBtn = document.getElementById('addTrackerEntryBtn');
  const saveTrackerBtn = document.getElementById('saveTrackerBtn');
  const clearTrackerFieldsBtn = document.getElementById('clearTrackerFieldsBtn');
  const resetTrackerBtn = document.getElementById('resetTrackerBtn');
  const generateBtn = document.getElementById('generateApplicationTrackerBtn');

  const entriesList = document.getElementById('trackerEntriesList');
  const entriesEmpty = document.getElementById('trackerEntriesEmpty');

  const resultWrap = document.getElementById('applicationTrackerResult');
  const downloadsWrap = document.getElementById('applicationTrackerDownloads');
  const pdfBtn = document.getElementById('downloadApplicationTrackerPdfBtn');
  const wordBtn = document.getElementById('downloadApplicationTrackerWordBtn');
  const textArea = document.getElementById('applicationTrackerText');
  const output = document.getElementById('applicationTrackerOutput');

  const STORAGE_KEY = 'rr_application_tracker_entries_v2';
  const STORAGE_FOCUS_KEY = 'rr_application_tracker_focus_v2';
  let entries = [];

  function getToken() {
    if (typeof getStoredToken === 'function') return getStoredToken() || '';
    if (typeof window.getStoredToken === 'function') return window.getStoredToken() || '';
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'application-tracker')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'application-tracker';
  }

  function getFileBaseName() {
    return slugify(`${focusInput?.value || 'application'}-tracker`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('AI Application Tracker', 20, y);
    y += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 170) : [''];
      wrapped.forEach((part) => {
        if (y > 275) {
          doc.addPage();
          y = 24;
        }
        doc.text(part, 20, y);
        y += 8;
      });
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function stageTone(stage) {
    const value = String(stage || '').toLowerCase();
    if (value.includes('offer')) return { bg: '#dcfce7', color: '#166534' };
    if (value.includes('interview') || value.includes('final')) return { bg: '#dbeafe', color: '#1d4ed8' };
    if (value.includes('reject')) return { bg: '#fee2e2', color: '#991b1b' };
    if (value.includes('phone')) return { bg: '#ede9fe', color: '#5b21b6' };
    return { bg: '#f1f5f9', color: '#334155' };
  }

  function clearEntryFields() {
    if (companyInput) companyInput.value = '';
    if (roleInput) roleInput.value = '';
    if (stageInput) stageInput.value = 'Applied';
    if (appliedDateInput) appliedDateInput.value = '';
    if (jobLinkInput) jobLinkInput.value = '';
    if (notesInput) notesInput.value = '';
  }

  function saveTrackerState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    localStorage.setItem(STORAGE_FOCUS_KEY, focusInput?.value.trim() || '');
  }

  function loadTrackerState() {
    try {
      entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(entries)) entries = [];
    } catch {
      entries = [];
    }
    if (focusInput) focusInput.value = localStorage.getItem(STORAGE_FOCUS_KEY) || '';
  }

  function renderEntries() {
    if (!entriesList || !entriesEmpty) return;

    entriesList.innerHTML = '';
    entriesEmpty.style.display = entries.length ? 'none' : 'block';

    entries.forEach((entry, index) => {
      const tone = stageTone(entry.stage);
      const card = document.createElement('div');
      card.style.border = '1px solid #1f3f63';
      card.style.borderRadius = '10px';
      card.style.padding = '12px';
      card.style.background = '#0f2746';
      card.style.color = '#e2e8f0';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:1.05rem;color:#f8fafc;">${entry.company} - ${entry.role}</div>
            <div style="margin-top:4px;color:#cbd5e1;font-size:0.95rem;">Applied: ${entry.appliedDate || 'Not set'}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span style="padding:4px 8px;border-radius:999px;background:${tone.bg};color:${tone.color};font-weight:700;font-size:0.82rem;">${entry.stage}</span>
            <button type="button" data-index="${index}" class="tracker-delete-btn" style="border:1px solid #ef4444;background:transparent;color:#fecaca;border-radius:8px;padding:4px 9px;cursor:pointer;">Delete</button>
          </div>
        </div>
        ${entry.notes ? `<div style="margin-top:8px;color:#cbd5e1;">Note: ${entry.notes}</div>` : ''}
        ${entry.jobLink ? `<div style="margin-top:8px;"><a href="${entry.jobLink}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:underline;">Open Job Posting</a></div>` : ''}
      `;
      entriesList.appendChild(card);
    });

    entriesList.querySelectorAll('.tracker-delete-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.getAttribute('data-index'));
        if (Number.isNaN(index)) return;
        entries.splice(index, 1);
        saveTrackerState();
        renderEntries();
      });
    });
  }

  function addEntry() {
    const company = companyInput?.value.trim();
    const role = roleInput?.value.trim();
    const stage = stageInput?.value || 'Applied';
    const appliedDate = appliedDateInput?.value || '';
    const jobLink = jobLinkInput?.value.trim();
    const notes = notesInput?.value.trim();

    if (!company || !role) {
      setMessage('Company and role are required to add an application.', '#dc2626');
      return;
    }

    entries.unshift({ company, role, stage, appliedDate, jobLink, notes });
    saveTrackerState();
    renderEntries();
    clearEntryFields();
    setMessage('Application added to tracker.', '#16a34a');
  }

  function categorizeApplications(items) {
    const summary = {
      interview: 0,
      offer: 0,
      waiting: 0,
      rejected: 0
    };

    items.forEach((entry) => {
      const lower = String(entry.stage || '').toLowerCase();
      if (lower.includes('offer')) {
        summary.offer += 1;
      } else if (lower.includes('interview') || lower.includes('phone') || lower.includes('final')) {
        summary.interview += 1;
      } else if (lower.includes('reject')) {
        summary.rejected += 1;
      } else {
        summary.waiting += 1;
      }
    });

    return summary;
  }

  function buildLocalTracker(items, focus) {
    const summary = categorizeApplications(items);
    const nextActions = items.slice(0, 3).map((entry, index) =>
      `- Priority ${index + 1}: Follow up with ${entry.company} for ${entry.role} (${entry.stage}).`
    );

    return [
      'AI Application Tracker Summary',
      '',
      `Active applications logged: ${items.length}`,
      `Interviews in motion: ${summary.interview}`,
      `Offers pending or received: ${summary.offer}`,
      `Waiting for response: ${summary.waiting}`,
      `Closed or rejected: ${summary.rejected}`,
      '',
      `Current focus: ${focus || 'Keep the pipeline moving and improve conversion.'}`,
      '',
      'Recommended next actions:',
      ...(nextActions.length ? nextActions : ['- Add at least three applications to generate a more useful action queue.']),
      '- Rebalance effort toward the stage where the most applications are currently stuck.',
      '- Schedule follow-up blocks twice a week so no application goes stale.'
    ].join('\n');
  }

  async function buildAiTracker(items, focus) {
    const token = getToken();
    if (!token) {
      return buildLocalTracker(items, focus);
    }

    const res = await fetch('/api/ai-application-tracker/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ entries: items, focus })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate AI tracker summary.');
    }

    return String(data.report || '').trim() || buildLocalTracker(items, focus);
  }

  async function generateSummary() {
    if (!entries.length) {
      setMessage('Add at least one application entry before generating the tracker.', '#dc2626');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    setMessage('', '#16a34a');

    try {
      const focus = focusInput?.value.trim() || '';
      saveTrackerState();

      let reportText;
      try {
        reportText = await buildAiTracker(entries, focus);
      } catch {
        reportText = buildLocalTracker(entries, focus);
        setMessage('AI summary unavailable right now. Generated local tracker summary instead.', '#b45309');
      }

      textArea.value = reportText;
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      if (!output.innerHTML) {
        setMessage('Application tracker summary generated and ready to download.', '#16a34a');
      }
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Tracker Summary';
    }
  }

  addEntryBtn?.addEventListener('click', addEntry);

  saveTrackerBtn?.addEventListener('click', () => {
    saveTrackerState();
    setMessage('Tracker saved.', '#16a34a');
  });

  clearTrackerFieldsBtn?.addEventListener('click', () => {
    clearEntryFields();
    if (focusInput) focusInput.value = '';
    setMessage('Input fields cleared.', '#64748b');
  });

  resetTrackerBtn?.addEventListener('click', () => {
    entries = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FOCUS_KEY);
    clearEntryFields();
    if (focusInput) focusInput.value = '';
    if (textArea) textArea.value = '';
    resultWrap.style.display = 'none';
    downloadsWrap.style.display = 'none';
    renderEntries();
    setMessage('Tracker reset complete.', '#64748b');
  });

  generateBtn?.addEventListener('click', generateSummary);

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the summary before downloading.', '#dc2626');
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        setMessage('PDF library not loaded.', '#dc2626');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatPdf(text, doc);
      doc.save(`${getFileBaseName()}.pdf`);
      setMessage('PDF downloaded.', '#16a34a');
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the summary before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }

  loadTrackerState();
  renderEntries();
});
