document.addEventListener('DOMContentLoaded', function () {
  const targetRoleInput = document.getElementById('learningTargetRole');
  const currentLevelInput = document.getElementById('learningCurrentLevel');
  const timePerWeekInput = document.getElementById('learningTimePerWeek');
  const jobDescriptionInput = document.getElementById('learningJobDescription');
  const resumeInput = document.getElementById('learningResume');

  const generateBtn = document.getElementById('generateLearningPlanBtn');
  const clearBtn = document.getElementById('clearLearningFieldsBtn');
  const resultWrap = document.getElementById('learningResultWrap');
  const downloadsWrap = document.getElementById('learningDownloads');
  const planText = document.getElementById('learningPlanText');
  const output = document.getElementById('learningOutput');
  const pdfBtn = document.getElementById('downloadLearningPdfBtn');
  const wordBtn = document.getElementById('downloadLearningWordBtn');
  const historyList = document.getElementById('learningHistoryList');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function slugify(value) {
    return String(value || 'learning-roadmap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'learning-roadmap';
  }

  function getFileBaseName() {
    return slugify(`${targetRoleInput?.value || 'role'}-learning-roadmap`);
  }

  function clearFields() {
    if (targetRoleInput) targetRoleInput.value = '';
    if (currentLevelInput) currentLevelInput.value = '';
    if (timePerWeekInput) timePerWeekInput.value = '5';
    if (jobDescriptionInput) jobDescriptionInput.value = '';
    if (resumeInput) resumeInput.value = '';
    if (planText) planText.value = '';
    if (resultWrap) resultWrap.style.display = 'none';
    if (downloadsWrap) downloadsWrap.style.display = 'none';
    setMessage('Fields cleared.', '#16a34a');
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function truncate(text, max = 220) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1).trim()}...`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openResumeGeneratorWithRoadmap(item) {
    const payload = {
      targetRole: String(item?.targetRole || '').trim(),
      roadmapText: String(item?.roadmapText || '').trim(),
      createdAt: item?.createdAt || new Date().toISOString()
    };

    try {
      sessionStorage.setItem('learning-selected-roadmap-v1', JSON.stringify(payload));
    } catch (err) {
      // Ignore session storage issues and continue navigation.
    }

    window.location.href = 'resume-generator.html?fromLearning=1';
  }

  function renderHistory(items) {
    if (!historyList) return;

    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      historyList.innerHTML = '<div style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;background:#f8fafc;">No saved learning roadmaps yet.</div>';
      return;
    }

    historyList.innerHTML = list.map((item, idx) => {
      const title = String(item.targetRole || 'Target Role').trim();
      const summary = truncate(item.roadmapText || '');
      const created = formatDate(item.createdAt);
      return `
        <div style="text-align:left;padding:12px;border:1px solid #dbe3ea;border-radius:10px;background:#ffffff;">
          <div style="font-weight:700;color:#1e293b;">${title}</div>
          <div style="font-size:0.92rem;color:#64748b;margin-top:4px;">${created}</div>
          <div style="font-size:0.95rem;color:#334155;margin-top:8px;line-height:1.55;">${escapeHtml(summary)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
            <button type="button" data-history-load-idx="${idx}" class="feature-launch-btn" style="padding:8px 12px;font-size:0.88rem;">Load Here</button>
            <button type="button" data-history-apply-idx="${idx}" class="feature-launch-btn" style="padding:8px 12px;font-size:0.88rem;background:#334155;">Apply to Resume Generator</button>
          </div>
        </div>
      `;
    }).join('');

    historyList.querySelectorAll('button[data-history-load-idx]').forEach((button) => {
      button.addEventListener('click', () => {
        const idx = Number(button.getAttribute('data-history-load-idx'));
        const selected = list[idx];
        if (!selected) return;

        if (targetRoleInput) targetRoleInput.value = String(selected.targetRole || '');
        if (currentLevelInput) currentLevelInput.value = String(selected.currentLevel || '');
        if (timePerWeekInput) timePerWeekInput.value = String(selected.timePerWeek || '5');
        if (jobDescriptionInput) jobDescriptionInput.value = String(selected.jobDescription || '');
        if (resumeInput) resumeInput.value = String(selected.resumeText || '');
        if (planText) planText.value = String(selected.roadmapText || '');
        if (resultWrap) resultWrap.style.display = 'block';
        if (downloadsWrap) downloadsWrap.style.display = 'block';
        setMessage('Loaded roadmap from history.', '#16a34a');
      });
    });

    historyList.querySelectorAll('button[data-history-apply-idx]').forEach((button) => {
      button.addEventListener('click', () => {
        const idx = Number(button.getAttribute('data-history-apply-idx'));
        const selected = list[idx];
        if (!selected) return;
        openResumeGeneratorWithRoadmap(selected);
      });
    });
  }

  async function loadLearningHistory() {
    const token = getToken();
    if (!token) {
      renderHistory([]);
      return;
    }

    try {
      const res = await fetch('/api/learning/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        renderHistory([]);
        return;
      }
      renderHistory(data.items || []);
    } catch (err) {
      renderHistory([]);
    }
  }

  function formatPdf(text, doc) {
    let y = 22;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('RoleRocketAI Learning Roadmap', 18, y);
    y += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);

    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 174) : [''];
      wrapped.forEach((part) => {
        if (y > 276) {
          doc.addPage();
          y = 22;
        }
        doc.text(part, 18, y);
        y += 7;
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

  generateBtn?.addEventListener('click', async function () {
    const targetRole = String(targetRoleInput?.value || '').trim();
    const currentLevel = String(currentLevelInput?.value || '').trim();
    const timePerWeek = String(timePerWeekInput?.value || '5').trim();
    const jobDescription = String(jobDescriptionInput?.value || '').trim();
    const resumeText = String(resumeInput?.value || '').trim();

    if (!targetRole || !jobDescription) {
      setMessage('Please add a target role and job description.', '#dc2626');
      return;
    }

    const token = getToken();
    if (!token) {
      setMessage('Please log in to use RoleRocketAI Learning.', '#dc2626');
      return;
    }

    setMessage('Generating your personalized learning roadmap...', '#2563eb');

    try {
      const res = await fetch('/api/learning/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetRole,
          currentLevel,
          timePerWeek,
          jobDescription,
          resumeText
        })
      });

      const data = await res.json();
      if (!res.ok || !data.result) {
        setMessage((data && data.error) || 'Failed to generate learning roadmap.', '#dc2626');
        return;
      }

      planText.value = String(data.result || '').trim();
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Learning roadmap generated.', '#16a34a');
      loadLearningHistory();
    } catch (err) {
      setMessage('Error generating learning roadmap.', '#dc2626');
    }
  });

  clearBtn?.addEventListener('click', clearFields);

  pdfBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
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
  });

  wordBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
      return;
    }
    const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 10pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
    downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
    setMessage('Word document downloaded.', '#16a34a');
  });

  loadLearningHistory();
});