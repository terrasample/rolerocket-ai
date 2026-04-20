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
  const structuredOutput = document.getElementById('learningStructuredOutput');
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
    if (structuredOutput) structuredOutput.innerHTML = '';
    if (resultWrap) resultWrap.style.display = 'none';
    if (downloadsWrap) downloadsWrap.style.display = 'none';
    setMessage('Fields cleared.', '#16a34a');
  }

  function parseRoadmapSections(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    const lines = raw.split('\n');
    const sections = [];
    let current = null;

    lines.forEach((line) => {
      const headingMatch = line.match(/^\s*(\d+)\)\s+(.+)$/);
      if (headingMatch) {
        if (current) sections.push(current);
        current = {
          index: Number(headingMatch[1]),
          title: String(headingMatch[2] || '').trim(),
          lines: []
        };
        return;
      }

      if (!current) {
        current = { index: 0, title: 'Overview', lines: [] };
      }
      current.lines.push(line);
    });

    if (current) sections.push(current);
    return sections;
  }

  function parseTeachingModules(sectionLines) {
    const chunks = String(sectionLines.join('\n') || '')
      .split(/\n\s*\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const modules = chunks.map((chunk) => {
      const module = {
        skill: '',
        why: '',
        learn: '',
        practice: '',
        proof: '',
        fallback: ''
      };

      chunk.split('\n').forEach((rawLine) => {
        const line = String(rawLine || '').trim();
        const match = line.match(/^(?:[-*]\s*)?(Missing Skill|Why this matters|Learn|Practice|Proof(?: of mastery)?):\s*(.*)$/i);
        if (!match) {
          if (line) module.fallback += (module.fallback ? '\n' : '') + line;
          return;
        }

        const key = match[1].toLowerCase();
        const value = String(match[2] || '').trim();
        if (key.includes('missing skill')) module.skill = value;
        else if (key.includes('why this matters')) module.why = value;
        else if (key === 'learn') module.learn = value;
        else if (key === 'practice') module.practice = value;
        else if (key.includes('proof')) module.proof = value;
      });

      return module;
    }).filter((module) => module.skill || module.why || module.learn || module.practice || module.proof || module.fallback);

    return modules;
  }

  function attachModuleTabs() {
    if (!structuredOutput) return;

    structuredOutput.querySelectorAll('[data-module-card]').forEach((card) => {
      const tabButtons = card.querySelectorAll('[data-module-tab]');
      const panes = card.querySelectorAll('[data-module-pane]');
      if (!tabButtons.length || !panes.length) return;

      tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const target = button.getAttribute('data-module-tab') || '';
          tabButtons.forEach((btn) => {
            const isActive = btn === button;
            btn.style.background = isActive ? '#0ea5e9' : '#e2e8f0';
            btn.style.color = isActive ? '#ffffff' : '#0f172a';
          });
          panes.forEach((pane) => {
            pane.style.display = pane.getAttribute('data-module-pane') === target ? 'block' : 'none';
          });
        });
      });
    });
  }

  function renderStructuredRoadmap(text) {
    if (!structuredOutput) return;

    const sections = parseRoadmapSections(text);
    if (!sections.length) {
      structuredOutput.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#475569;">No learning sections found.</div>';
      return;
    }

    structuredOutput.innerHTML = sections.map((section, sectionIdx) => {
      const safeTitle = escapeHtml(section.title || `Section ${section.index || sectionIdx + 1}`);

      if (/skill teaching modules/i.test(section.title || '')) {
        const modules = parseTeachingModules(section.lines || []);
        if (!modules.length) {
          return `
            <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
              <h4 style="margin:0 0 8px 0;color:#0f172a;">${safeTitle}</h4>
              <div style="white-space:pre-wrap;color:#334155;line-height:1.6;">${escapeHtml((section.lines || []).join('\n').trim())}</div>
            </article>
          `;
        }

        const moduleCards = modules.map((module, moduleIdx) => {
          const tabPrefix = `module-${sectionIdx}-${moduleIdx}`;
          const title = escapeHtml(module.skill || `Skill Module ${moduleIdx + 1}`);
          const why = escapeHtml(module.why || module.fallback || 'No details provided.');
          const learn = escapeHtml(module.learn || module.fallback || 'No details provided.');
          const practice = escapeHtml(module.practice || module.fallback || 'No details provided.');
          const proof = escapeHtml(module.proof || module.fallback || 'No details provided.');

          return `
            <div data-module-card style="border:1px solid #dbe3ea;border-radius:10px;padding:12px;background:#f8fafc;">
              <div style="font-weight:700;color:#0f172a;margin-bottom:8px;">${title}</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button type="button" data-module-tab="${tabPrefix}-why" style="padding:6px 10px;border:none;border-radius:999px;background:#0ea5e9;color:#ffffff;font-size:0.85rem;cursor:pointer;">Why</button>
                <button type="button" data-module-tab="${tabPrefix}-learn" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">Learn</button>
                <button type="button" data-module-tab="${tabPrefix}-practice" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">Practice</button>
                <button type="button" data-module-tab="${tabPrefix}-proof" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">Proof</button>
              </div>
              <div data-module-pane="${tabPrefix}-why" style="display:block;color:#334155;line-height:1.6;">${why}</div>
              <div data-module-pane="${tabPrefix}-learn" style="display:none;color:#334155;line-height:1.6;">${learn}</div>
              <div data-module-pane="${tabPrefix}-practice" style="display:none;color:#334155;line-height:1.6;">${practice}</div>
              <div data-module-pane="${tabPrefix}-proof" style="display:none;color:#334155;line-height:1.6;">${proof}</div>
            </div>
          `;
        }).join('');

        return `
          <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
            <h4 style="margin:0 0 10px 0;color:#0f172a;">${safeTitle}</h4>
            <div style="display:grid;gap:10px;">${moduleCards}</div>
          </article>
        `;
      }

      const bodyLines = (section.lines || []).filter((line) => String(line || '').trim().length);
      const body = bodyLines.length
        ? `<ul style="margin:0 0 0 18px;padding:0;display:grid;gap:6px;color:#334155;line-height:1.6;">${bodyLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
        : '<div style="color:#64748b;">No items listed.</div>';

      return `
        <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
          <h4 style="margin:0 0 8px 0;color:#0f172a;">${safeTitle}</h4>
          ${body}
        </article>
      `;
    }).join('');

    attachModuleTabs();
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
        renderStructuredRoadmap(String(selected.roadmapText || ''));
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

    setMessage('Analyzing missing skills and building your skill-teaching plan...', '#2563eb');

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
      renderStructuredRoadmap(planText.value);
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Missing skills analysis and learning plan generated.', '#16a34a');
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