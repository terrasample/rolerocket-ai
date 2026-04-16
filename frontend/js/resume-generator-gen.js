document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const savePdfBtn = document.getElementById('saveResumePdfBtnGen');
  const saveWordBtn = document.getElementById('saveResumeWordBtnGen');
  const output = document.getElementById('resumeOutputGen');
  const resumeUploadInput = document.getElementById('resumeBaseUploadGen');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessageGen');
  const photoInput = document.getElementById('resumePhotoUploadGen');
  const photoPreview = document.getElementById('resumePhotoPreviewGen');

  const THEMES = [
    {
      id: 'forest-ribbon',
      primary: '#0f4a47',
      accent: '#7aa3a0',
      sidebarBg: '#f5f7f8',
      headerText: '#ffffff',
      headingText: '#0f4a47',
      font: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif"
    },
    {
      id: 'gold-sidebar',
      primary: '#7f6500',
      accent: '#b08f0e',
      sidebarBg: '#7f6500',
      headerText: '#111827',
      headingText: '#7f6500',
      font: "'Arial Narrow', Arial, sans-serif"
    },
    {
      id: 'slate-modern',
      primary: '#1e3a56',
      accent: '#4f83a9',
      sidebarBg: '#eef4f9',
      headerText: '#ffffff',
      headingText: '#1e3a56',
      font: "'Verdana', 'Segoe UI', sans-serif"
    }
  ];

  let lastRawResume = '';
  let lastStructuredResume = null;
  let lastPhotoDataUrl = '';
  let templateQueue = [];
  let lastTemplateIdx = -1;
  const templateStateKey = `resume-template-queue-v1-${THEMES.map((t) => t.id).join('|')}`;
  let templateStateReadyPromise = null;

  function getAuthToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return 'RR';
  }

  function splitName(fullName) {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
      first: parts[0] || '',
      rest: parts.slice(1).join(' ')
    };
  }

  function shuffleArray(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function saveTemplateStateToServer() {
    const token = getAuthToken();
    if (!token) return;

    try {
      await fetch('/api/resume/template-state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          queue: templateQueue,
          lastTemplateIdx
        })
      });
    } catch (err) {
      // Keep local fallback behavior when server sync fails.
    }
  }

  function saveTemplateState() {
    try {
      sessionStorage.setItem(templateStateKey, JSON.stringify({
        templateQueue,
        lastTemplateIdx
      }));
    } catch (err) {
      // Ignore storage failures in private/restricted contexts.
    }

    saveTemplateStateToServer();
  }

  function loadTemplateState() {
    try {
      const raw = sessionStorage.getItem(templateStateKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const validIndices = new Set(THEMES.map((_, idx) => idx));
      const safeQueue = Array.isArray(parsed.templateQueue)
        ? parsed.templateQueue.filter((idx) => validIndices.has(idx))
        : [];
      const safeLast = validIndices.has(parsed.lastTemplateIdx) ? parsed.lastTemplateIdx : -1;

      templateQueue = safeQueue;
      lastTemplateIdx = safeLast;
    } catch (err) {
      templateQueue = [];
      lastTemplateIdx = -1;
    }
  }

  async function loadTemplateStateFromServer() {
    const token = getAuthToken();
    if (!token) return;

    try {
      const res = await fetch('/api/resume/template-state', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) return;
      const data = await res.json();
      const validIndices = new Set(THEMES.map((_, idx) => idx));
      const serverState = data && data.state ? data.state : {};
      const safeQueue = Array.isArray(serverState.queue)
        ? serverState.queue.filter((idx) => validIndices.has(idx))
        : [];
      const safeLast = validIndices.has(serverState.lastTemplateIdx) ? serverState.lastTemplateIdx : -1;

      templateQueue = safeQueue;
      lastTemplateIdx = safeLast;

      try {
        sessionStorage.setItem(templateStateKey, JSON.stringify({
          templateQueue,
          lastTemplateIdx
        }));
      } catch (err) {
        // Ignore local storage fallback issues.
      }
    } catch (err) {
      // Keep local fallback behavior when server fetch fails.
    }
  }

  async function initTemplateState() {
    loadTemplateState();
    await loadTemplateStateFromServer();
  }

  function getNextTemplateIndex() {
    if (!templateQueue.length) {
      templateQueue = shuffleArray(THEMES.map((_, idx) => idx));

      if (templateQueue.length > 1 && templateQueue[0] === lastTemplateIdx) {
        const first = templateQueue.shift();
        templateQueue.push(first);
      }

      saveTemplateState();
    }

    const nextIdx = templateQueue.shift();
    lastTemplateIdx = nextIdx;
    saveTemplateState();
    return nextIdx;
  }

  templateStateReadyPromise = initTemplateState();

  function extractContactInfo(sourceText) {
    const text = String(sourceText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const phone = (text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) || [])[0] || '';
    const linkedin = (text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i) || [])[0] || '';

    let fullName = '';
    for (const line of lines.slice(0, 6)) {
      if (/^[A-Za-z][A-Za-z\s'.-]{2,}$/.test(line) && line.split(/\s+/).length <= 5) {
        fullName = line;
        break;
      }
    }

    const cityStateLine = lines.find((line) => /,\s*[A-Z]{2}\b/.test(line)) || '';
    return {
      fullName,
      email,
      phone,
      location: cityStateLine,
      linkedin
    };
  }

  function parseResume(rawText, fallbackFromBase) {
    const text = String(rawText || '').replace(/\r/g, '');
    const lines = text.split('\n').map((line) => line.trimRight());

    const structured = {
      fullName: fallbackFromBase.fullName || 'Candidate Name',
      contactLines: [fallbackFromBase.phone, fallbackFromBase.email, fallbackFromBase.location, fallbackFromBase.linkedin].filter(Boolean),
      profile: '',
      experiences: [],
      education: [],
      skills: [],
      awards: []
    };

    const sectionIndex = {
      PROFILE: -1,
      EXPERIENCE: -1,
      EDUCATION: -1,
      SKILLS: -1,
      AWARDS: -1,
      IMPROVEMENTS: -1
    };

    lines.forEach((line, idx) => {
      const key = line.replace(/[:\-]/g, '').trim().toUpperCase();
      if (Object.prototype.hasOwnProperty.call(sectionIndex, key)) sectionIndex[key] = idx;
    });

    if (lines[0] && /^[A-Za-z][A-Za-z\s'.-]{2,}$/.test(lines[0]) && lines[0].split(/\s+/).length <= 5) {
      structured.fullName = lines[0].trim();
    }

    function between(startIdx, endIdx) {
      const start = startIdx >= 0 ? startIdx + 1 : -1;
      if (start < 0) return [];
      const end = endIdx >= 0 ? endIdx : lines.length;
      return lines.slice(start, end).map((line) => line.trim()).filter(Boolean);
    }

    const ordered = Object.entries(sectionIndex)
      .filter(([, idx]) => idx >= 0)
      .sort((a, b) => a[1] - b[1]);

    const nextSectionStart = (name) => {
      const current = ordered.find((item) => item[0] === name);
      if (!current) return -1;
      const currentPos = ordered.indexOf(current);
      const next = ordered[currentPos + 1];
      return next ? next[1] : -1;
    };

    structured.profile = between(sectionIndex.PROFILE, nextSectionStart('PROFILE')).join(' ');

    const experienceLines = between(sectionIndex.EXPERIENCE, nextSectionStart('EXPERIENCE'));
    let current = null;
    experienceLines.forEach((line) => {
      const normalized = line.replace(/^[-*]\s*/, '').trim();
      const isNewRole = /\b(20\d{2}|19\d{2})\b/.test(normalized) || normalized.includes('|') || normalized.split(',').length >= 2;

      if (isNewRole && normalized.length > 8) {
        if (current) structured.experiences.push(current);
        current = { heading: normalized, bullets: [] };
        return;
      }

      if (!current) current = { heading: 'Experience', bullets: [] };
      current.bullets.push(normalized);
    });
    if (current) structured.experiences.push(current);

    structured.education = between(sectionIndex.EDUCATION, nextSectionStart('EDUCATION'));
    structured.skills = between(sectionIndex.SKILLS, nextSectionStart('SKILLS'))
      .join(', ')
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    structured.awards = between(sectionIndex.AWARDS, nextSectionStart('AWARDS'));

    if (!structured.profile) {
      structured.profile = 'Results-driven professional with relevant experience and a strong record of delivering measurable outcomes.';
    }

    if (!structured.experiences.length) {
      structured.experiences = [{
        heading: 'Professional Experience',
        bullets: [
          'Tailored core achievements to align with the target role requirements.',
          'Highlighted impact-driven accomplishments and relevant skills.'
        ]
      }];
    }

    if (!structured.education.length) structured.education = ['Education details available upon request'];
    if (!structured.skills.length) structured.skills = ['Communication', 'Collaboration', 'Problem Solving'];

    return structured;
  }

  function buildPhotoMarkup(model, theme, square) {
    const borderRadius = square ? '12px' : '999px';
    const size = square ? 130 : 124;

    if (model.photoDataUrl) {
      return `<img src="${model.photoDataUrl}" alt="Profile" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${borderRadius};border:3px solid ${theme.accent};display:block;" />`;
    }

    return `<div style="width:${size}px;height:${size}px;border-radius:${borderRadius};border:3px solid ${theme.accent};display:flex;align-items:center;justify-content:center;background:${theme.primary};color:#fff;font-weight:900;font-size:38px;">${escapeHtml(getInitials(model.fullName))}</div>`;
  }

  function sentenceBullets(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function renderBulletListHtml(items, fontSize, color, marginBottom) {
    return (items || []).map((item) => `
      <div style="display:flex;align-items:flex-start;gap:8px;font-size:${fontSize};line-height:1.45;color:${color};margin-bottom:${marginBottom};">
        <span style="font-weight:900;line-height:1;">•</span>
        <span>${escapeHtml(item)}</span>
      </div>
    `).join('');
  }

  function renderSectionHeading(label, theme, fontSize, extraStyles) {
    return `<div style="font-size:${fontSize};font-weight:900;color:${theme.headingText};margin-bottom:8px;${extraStyles || ''}">${label}</div>`;
  }

  function renderTemplateForest(model, theme) {
    const name = splitName(model.fullName);
    const profileBullets = sentenceBullets(model.profile);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:${theme.primary};padding:16px 22px 22px 22px;color:${theme.headerText};display:flex;gap:22px;align-items:flex-end;">
          <div style="margin-top:8px;">${buildPhotoMarkup(model, theme, false)}</div>
          <div style="flex:1;">
            <div style="font-size:52px;line-height:1;font-weight:900;letter-spacing:1px;">${escapeHtml((name.first + ' ' + name.rest).trim().toUpperCase())}</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:245px 1fr;">
          <aside style="padding:18px;background:${theme.sidebarBg};border-right:1px solid #e5e7eb;">
            ${renderSectionHeading('CONTACT', theme, '24px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:14px;line-height:1.45;color:#1f2937;margin-bottom:4px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('KEY SKILLS', theme, '24px', 'margin-top:20px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '14px', '#1f2937', '4px')}
            ${renderSectionHeading('CERTIFICATIONS', theme, '24px', 'margin-top:20px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '14px', '#1f2937', '2px')}
          </aside>
          <section style="padding:18px 22px 22px 22px;">
            ${renderSectionHeading('PROFILE', theme, '32px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '16px', '#374151', '6px')}
            <hr style="border:none;border-top:1px solid #d1d5db;margin:12px 0 12px 0;" />
            ${renderSectionHeading('EXPERIENCE', theme, '32px')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:12px;">
                <div style="font-size:18px;font-weight:800;color:#111827;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '15px', '#374151', '4px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '32px', 'margin-top:6px;')}
            ${renderBulletListHtml(model.education || [], '15px', '#374151', '4px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateGold(model, theme) {
    const name = splitName(model.fullName);
    const profileBullets = sentenceBullets(model.profile);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="display:grid;grid-template-columns:250px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:20px;color:#fff;min-height:100%;">
            <div style="display:flex;justify-content:center;margin:4px 0 22px 0;">${buildPhotoMarkup(model, theme, true)}</div>
            <div style="font-size:36px;font-weight:900;text-align:center;letter-spacing:1px;margin-bottom:20px;">${escapeHtml(getInitials(model.fullName))}</div>
            <div style="font-size:34px;font-weight:900;margin-bottom:8px;color:#fff;">CONTACT</div>
            ${(model.contactLines || []).map((line) => `<div style="font-size:14px;line-height:1.5;margin-bottom:3px;">${escapeHtml(line)}</div>`).join('')}
            <div style="font-size:34px;font-weight:900;margin:20px 0 8px 0;color:#fff;">KEY SKILLS</div>
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '14px', '#ffffff', '4px')}
            <div style="font-size:34px;font-weight:900;margin:20px 0 8px 0;color:#fff;">EDUCATION</div>
            ${renderBulletListHtml(model.education || [], '14px', '#ffffff', '4px')}
          </aside>
          <section style="padding:18px 22px;">
            <div style="font-size:60px;line-height:1;font-weight:900;color:#111827;">${escapeHtml(name.first)}<span style="font-weight:500;">${escapeHtml(name.rest ? ' ' + name.rest : '')}</span></div>
            <div style="font-size:26px;color:#4b5563;font-weight:700;margin:6px 0 8px 0;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
            ${renderSectionHeading('PROFILE', theme, '18px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '15px', '#4b5563', '4px')}

            ${renderSectionHeading('EXPERIENCE', theme, '18px', 'margin-top:12px;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:10px;">
                <div style="font-size:17px;font-weight:800;color:#111827;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '14px', '#374151', '4px')}
              </div>
            `).join('')}

            ${renderSectionHeading('CERTIFICATIONS', theme, '18px', 'margin-top:8px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '14px', '#374151', '4px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateSlate(model, theme) {
    const profileBullets = sentenceBullets(model.profile);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:10px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:linear-gradient(110deg, ${theme.primary}, ${theme.accent});padding:20px 22px;color:${theme.headerText};display:flex;align-items:center;gap:18px;">
          ${buildPhotoMarkup(model, theme, false)}
          <div>
            <div style="font-size:44px;font-weight:900;line-height:1;">${escapeHtml(model.fullName.toUpperCase())}</div>
            <div style="font-size:20px;font-weight:700;margin-top:6px;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:230px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:18px;border-right:1px solid #d1d5db;">
            ${renderSectionHeading('CONTACT', theme, '20px', 'margin-bottom:6px;')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.45;color:#1f2937;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '20px', 'margin:16px 0 6px 0;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 9), '13px', '#1f2937', '2px')}
          </aside>
          <section style="padding:18px 22px;">
            ${renderSectionHeading('PROFILE', theme, '24px', 'margin-bottom:6px;')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '14px', '#374151', '4px')}
            ${renderSectionHeading('EXPERIENCE', theme, '24px', 'margin-bottom:6px;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:10px;">
                <div style="font-size:16px;font-weight:800;color:#111827;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '14px', '#374151', '4px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '24px', 'margin-bottom:6px;')}
            ${renderBulletListHtml(model.education || [], '14px', '#374151', '4px')}
            ${renderSectionHeading('AWARDS', theme, '24px', 'margin:8px 0 6px 0;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '14px', '#374151', '4px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderResumeTemplate(model) {
    const theme = model.theme || THEMES[0];
    if (theme.id === 'gold-sidebar') return renderTemplateGold(model, theme);
    if (theme.id === 'slate-modern') return renderTemplateSlate(model, theme);
    return renderTemplateForest(model, theme);
  }

  function renderError(message) {
    output.innerHTML = `<div style="color:#dc2626;font-size:1.05rem;">${escapeHtml(message)}</div>`;
  }

  function statusBanner(message, ok) {
    output.insertAdjacentHTML(
      'afterbegin',
      `<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:${ok ? '#ecfdf5' : '#fef2f2'};color:${ok ? '#166534' : '#991b1b'};border:1px solid ${ok ? '#86efac' : '#fecaca'};">${escapeHtml(message)}</div>`
    );
  }

  async function loadResumeFileIntoField(file, textarea, messageEl) {
    const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
    if (!file || !textarea) return;

    if (messageEl) {
      messageEl.textContent = 'Loading resume file...';
      messageEl.style.color = '#64748b';
    }

    try {
      if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const formData = new FormData();
        formData.append('resumeFile', file);
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch('/api/resume/upload', { method: 'POST', headers, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to parse uploaded resume.');
        textarea.value = data.content || '';
      } else if (file.type.startsWith('text/') || /\.(txt|md|rtf)$/i.test(file.name)) {
        textarea.value = await file.text();
      } else {
        throw new Error('Use a TXT, PDF, or DOCX resume file.');
      }

      if (messageEl) {
        messageEl.textContent = `Loaded ${file.name}.`;
        messageEl.style.color = '#16a34a';
      }

      if (window.RoleRocketQuickstart) {
        window.RoleRocketQuickstart.completeStep('resume', 'resume_upload');
      }
    } catch (error) {
      if (messageEl) {
        messageEl.textContent = error.message || 'Could not load the uploaded resume.';
        messageEl.style.color = '#dc2626';
      }
    }
  }

  function buildResumeModel(structured, targetRole) {
    const idx = getNextTemplateIndex();
    return {
      ...structured,
      targetRole,
      photoDataUrl: lastPhotoDataUrl,
      theme: THEMES[idx]
    };
  }

  function exportResumePdf(model) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const theme = model.theme || THEMES[0];

    const leftX = 12;
    const leftW = 56;
    const rightX = 74;
    const rightW = 124;

    doc.setFillColor(
      parseInt(theme.sidebarBg.slice(1, 3), 16),
      parseInt(theme.sidebarBg.slice(3, 5), 16),
      parseInt(theme.sidebarBg.slice(5, 7), 16)
    );
    doc.rect(10, 10, leftW + 4, 277, 'F');

    doc.setFillColor(
      parseInt(theme.primary.slice(1, 3), 16),
      parseInt(theme.primary.slice(3, 5), 16),
      parseInt(theme.primary.slice(5, 7), 16)
    );
    doc.rect(70, 10, 130, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text((model.fullName || '').toUpperCase().slice(0, 40), rightX, 21);

    doc.setFontSize(10);
    doc.text((model.targetRole || 'Professional Candidate').slice(0, 60), rightX, 28);

    let leftY = 42;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTACT', leftX, leftY);
    leftY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    (model.contactLines || []).forEach((line) => {
      const wrapped = doc.splitTextToSize(line, leftW - 4);
      doc.text(wrapped, leftX, leftY);
      leftY += wrapped.length * 4.2;
    });

    leftY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('KEY SKILLS', leftX, leftY);
    leftY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    (model.skills || []).slice(0, 10).forEach((skill) => {
      const wrapped = doc.splitTextToSize(`• ${skill}`, leftW - 4);
      doc.text(wrapped, leftX, leftY);
      leftY += wrapped.length * 4.2;
    });

    let rightY = 42;

    function drawTitle(title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(
        parseInt(theme.primary.slice(1, 3), 16),
        parseInt(theme.primary.slice(3, 5), 16),
        parseInt(theme.primary.slice(5, 7), 16)
      );
      doc.text(title, rightX, rightY);
      rightY += 5;
      doc.setTextColor(31, 41, 55);
    }

    drawTitle('PROFILE');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    let wrapped = [];
    sentenceBullets(model.profile).forEach((line) => {
      wrapped = doc.splitTextToSize(`• ${line}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });
    rightY += 3;

    drawTitle('PROFESSIONAL EXPERIENCE');
    model.experiences.forEach((exp) => {
      if (rightY > 272) {
        doc.addPage();
        rightY = 16;
      }
      doc.setFont('helvetica', 'bold');
      wrapped = doc.splitTextToSize(exp.heading || '', rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;

      doc.setFont('helvetica', 'normal');
      (exp.bullets || []).forEach((bullet) => {
        const bulletWrapped = doc.splitTextToSize(`• ${bullet}`, rightW);
        doc.text(bulletWrapped, rightX, rightY);
        rightY += bulletWrapped.length * 4.2;
      });
      rightY += 2;
    });

    drawTitle('EDUCATION');
    (model.education || []).forEach((line) => {
      wrapped = doc.splitTextToSize(`• ${line}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    rightY += 2;
    drawTitle('CERTIFICATIONS');
    (model.awards.length ? model.awards : ['N/A']).forEach((line) => {
      wrapped = doc.splitTextToSize(`• ${line}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    doc.save('tailored-resume.pdf');
  }

  function exportResumeWord(model) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:${model.theme.font};margin:0;color:#111827;">
  ${renderResumeTemplate(model)}
</body>
</html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tailored-resume.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  photoInput?.addEventListener('change', function (event) {
    const file = event.target.files?.[0];
    if (!file) {
      lastPhotoDataUrl = '';
      photoPreview.innerHTML = '';
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      lastPhotoDataUrl = '';
      photoPreview.innerHTML = '<div style="color:#dc2626;font-size:0.9rem;">Use JPG, PNG, or WEBP.</div>';
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      lastPhotoDataUrl = String(reader.result || '');
      photoPreview.innerHTML = `<img src="${lastPhotoDataUrl}" alt="Photo preview" style="width:88px;height:88px;border-radius:999px;object-fit:cover;border:2px solid #d1d5db;" />`;
    };
    reader.readAsDataURL(file);
  });

  resumeUploadInput?.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    await loadResumeFileIntoField(file, document.getElementById('resumeBaseGen'), resumeUploadMessage);
  });

  generateBtn?.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const baseResume = document.getElementById('resumeBaseGen').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescriptionGen').value.trim();

    if (!jobTitle || !company || !baseResume || !fullJobDescription) {
      renderError('Please fill in all fields.');
      return;
    }

    output.innerHTML = '<div style="color:#2563eb;">Generating resume...</div>';

    try {
      if (templateStateReadyPromise) await templateStateReadyPromise;

      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}\n\nFull Job Description:\n${fullJobDescription}`;
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume: baseResume })
      });
      const data = await res.json();

      if (!res.ok || !data.result) {
        renderError((data && data.error) || 'Failed to generate resume.');
        return;
      }

      const raw = String(data.result || '').trim();
      lastRawResume = raw;
      const structured = parseResume(raw, extractContactInfo(baseResume));
      lastStructuredResume = buildResumeModel(structured, jobTitle);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('Resume generated with a unique design. Use Save as PDF or Save as Word for upload-ready files.', true);

      if (window.RoleRocketQuickstart) {
        window.RoleRocketQuickstart.completeStep('tailor', 'resume_generated');
      }
    } catch (err) {
      renderError('Error generating resume.');
    }
  });

  savePdfBtn?.addEventListener('click', function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to save. Please generate first.');
        return;
      }
      exportResumePdf(lastStructuredResume);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('PDF downloaded.', true);
    } catch (err) {
      renderError(err.message || 'Could not generate PDF.');
    }
  });

  saveWordBtn?.addEventListener('click', function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to save. Please generate first.');
        return;
      }
      exportResumeWord(lastStructuredResume);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('Word document downloaded.', true);
    } catch (err) {
      renderError('Could not generate Word document.');
    }
  });
});
