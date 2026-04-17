document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const savePdfBtn = document.getElementById('saveResumePdfBtnGen');
  const saveWordBtn = document.getElementById('saveResumeWordBtnGen');
  const output = document.getElementById('resumeOutputGen');
  const resumeUploadInput = document.getElementById('resumeBaseUploadGen');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessageGen');
  const photoInput = document.getElementById('resumePhotoUploadGen');
  const photoPreview = document.getElementById('resumePhotoPreviewGen');
  const photoControls = document.getElementById('resumePhotoControlsGen');
  const photoXInput = document.getElementById('resumePhotoXGen');
  const photoYInput = document.getElementById('resumePhotoYGen');
  const photoActions = document.getElementById('resumePhotoActionsGen');
  const photoReplaceBtn = document.getElementById('resumePhotoReplaceBtnGen');
  const photoRemoveBtn = document.getElementById('resumePhotoRemoveBtnGen');
  const layoutSelect = document.getElementById('resumeLayoutSelectGen');
  const layoutHelp = document.getElementById('resumeLayoutHelpGen');
  const refreshLayoutBtn = document.getElementById('resumeRefreshLayoutBtnGen');

  const THEMES = [
    {
      id: 'forest-ribbon',
      name: 'Forest Ribbon',
      layoutType: 'forest',
      primary: '#0f4a47',
      accent: '#7aa3a0',
      sidebarBg: '#f5f7f8',
      headerText: '#ffffff',
      headingText: '#0f4a47',
      font: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif"
    },
    {
      id: 'gold-sidebar',
      name: 'Golden Sidebar',
      layoutType: 'gold',
      primary: '#7f6500',
      accent: '#b08f0e',
      sidebarBg: '#7f6500',
      headerText: '#111827',
      headingText: '#7f6500',
      font: "'Arial Narrow', Arial, sans-serif"
    },
    {
      id: 'slate-modern',
      name: 'Slate Modern',
      layoutType: 'slate',
      primary: '#1e3a56',
      accent: '#4f83a9',
      sidebarBg: '#eef4f9',
      headerText: '#ffffff',
      headingText: '#1e3a56',
      font: "'Verdana', 'Segoe UI', sans-serif"
    },
    {
      id: 'copper-clean',
      name: 'Copper Clean',
      layoutType: 'forest',
      primary: '#8a3f1f',
      accent: '#d18f63',
      sidebarBg: '#fff7f2',
      headerText: '#ffffff',
      headingText: '#8a3f1f',
      font: "'Georgia', 'Times New Roman', serif"
    },
    {
      id: 'midnight-column',
      name: 'Midnight Column',
      layoutType: 'gold',
      primary: '#172554',
      accent: '#60a5fa',
      sidebarBg: '#172554',
      headerText: '#ffffff',
      headingText: '#172554',
      font: "'Gill Sans', 'Segoe UI', sans-serif"
    },
    {
      id: 'sage-editorial',
      name: 'Sage Editorial',
      layoutType: 'slate',
      primary: '#31524a',
      accent: '#86b4a3',
      sidebarBg: '#f1f7f4',
      headerText: '#ffffff',
      headingText: '#31524a',
      font: "'Palatino Linotype', 'Book Antiqua', serif"
    },
    {
      id: 'berry-executive',
      name: 'Berry Executive',
      layoutType: 'forest',
      primary: '#6b1f3a',
      accent: '#d97b9c',
      sidebarBg: '#fcf4f7',
      headerText: '#ffffff',
      headingText: '#6b1f3a',
      font: "'Avenir Next', 'Segoe UI', sans-serif"
    },
    {
      id: 'onyx-portfolio',
      name: 'Onyx Portfolio',
      layoutType: 'gold',
      primary: '#111827',
      accent: '#f59e0b',
      sidebarBg: '#111827',
      headerText: '#ffffff',
      headingText: '#111827',
      font: "'Helvetica Neue', Arial, sans-serif"
    },
    {
      id: 'ocean-balance',
      name: 'Ocean Balance',
      layoutType: 'slate',
      primary: '#0f4c5c',
      accent: '#59b3c3',
      sidebarBg: '#eef9fb',
      headerText: '#ffffff',
      headingText: '#0f4c5c',
      font: "'Optima', 'Segoe UI', sans-serif"
    }
  ];

  const PLAN_LAYOUT_LIMITS = {
    free: 1,
    pro: 3,
    premium: 9,
    elite: 9,
    lifetime: 9
  };

  const ELITE_DYNAMIC_LAYOUT_ID = 'elite-dynamic';
  const RESUME_SECTION_HEADERS = new Set(['NAME', 'CONTACT', 'PROFILE', 'SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'AWARDS', 'CERTIFICATIONS', 'IMPROVEMENTS', 'PROJECTS']);
  const DYNAMIC_THEME_PALETTES = [
    { primary: '#1f2937', accent: '#f97316', sidebarBg: '#f9fafb', headerText: '#ffffff', headingText: '#1f2937' },
    { primary: '#1d4ed8', accent: '#7dd3fc', sidebarBg: '#eff6ff', headerText: '#ffffff', headingText: '#1d4ed8' },
    { primary: '#14532d', accent: '#86efac', sidebarBg: '#f0fdf4', headerText: '#ffffff', headingText: '#14532d' },
    { primary: '#7c2d12', accent: '#fdba74', sidebarBg: '#fff7ed', headerText: '#ffffff', headingText: '#7c2d12' },
    { primary: '#5b21b6', accent: '#c4b5fd', sidebarBg: '#f5f3ff', headerText: '#ffffff', headingText: '#5b21b6' },
    { primary: '#9f1239', accent: '#f9a8d4', sidebarBg: '#fff1f2', headerText: '#ffffff', headingText: '#9f1239' }
  ];
  const DYNAMIC_THEME_FONTS = [
    "'Avenir Next', 'Segoe UI', sans-serif",
    "'Georgia', 'Times New Roman', serif",
    "'Gill Sans', 'Segoe UI', sans-serif",
    "'Optima', 'Segoe UI', sans-serif",
    "'Palatino Linotype', 'Book Antiqua', serif"
  ];

  let lastRawResume = '';
  let lastStructuredResume = null;
  let lastPhotoDataUrl = '';
  let lastPhotoPosition = { x: 50, y: 35 };
  let userPlan = 'free';
  let accountName = '';
  let selectedLayoutId = '';
  let templateQueue = [];
  let lastTemplateIdx = -1;
  const templateStateKey = `resume-template-queue-v1-${THEMES.map((t) => t.id).join('|')}`;
  const layoutSelectionKey = 'resume-layout-selection-v2';
  let templateStateReadyPromise = null;

  function getAuthToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function normalizePlan(plan) {
    const normalized = String(plan || 'free').toLowerCase();
    return PLAN_LAYOUT_LIMITS[normalized] ? normalized : 'free';
  }

  function getThemeLimitForPlan(plan) {
    return PLAN_LAYOUT_LIMITS[normalizePlan(plan)] || 1;
  }

  function canUseDynamicLayout(plan) {
    const normalized = normalizePlan(plan);
    return normalized === 'elite' || normalized === 'lifetime';
  }

  function getAvailableThemesForPlan(plan) {
    return THEMES.slice(0, getThemeLimitForPlan(plan));
  }

  function getLayoutHelpText(plan) {
    const normalized = normalizePlan(plan);
    if (normalized === 'free') return 'Free includes 1 layout.';
    if (normalized === 'pro') return 'Pro unlocks 3 layouts.';
    if (normalized === 'premium') return 'Premium unlocks 9 layouts.';
    return 'Elite unlocks all 9 layouts plus unlimited dynamic refreshes.';
  }

  function loadSelectedLayoutId() {
    try {
      return sessionStorage.getItem(layoutSelectionKey) || '';
    } catch (err) {
      return '';
    }
  }

  function saveSelectedLayoutId(layoutId) {
    try {
      sessionStorage.setItem(layoutSelectionKey, layoutId || '');
    } catch (err) {
      // Ignore storage issues.
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeBulletText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[\u2022\u25cf\u25e6\u25aa\-*]+\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .trim();
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

  function randomFrom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createDynamicEliteTheme() {
    const palette = randomFrom(DYNAMIC_THEME_PALETTES);
    const layoutType = randomFrom(['forest', 'gold', 'slate']);
    return {
      id: `${ELITE_DYNAMIC_LAYOUT_ID}-${Date.now()}`,
      name: 'Elite Dynamic',
      layoutType,
      primary: palette.primary,
      accent: palette.accent,
      sidebarBg: palette.sidebarBg,
      headerText: palette.headerText,
      headingText: palette.headingText,
      font: randomFrom(DYNAMIC_THEME_FONTS)
    };
  }

  function themeIndexById(themeId) {
    return THEMES.findIndex((theme) => theme.id === themeId);
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

  async function loadCurrentPlan() {
    const token = getAuthToken();
    if (!token) {
      userPlan = 'free';
      return;
    }

    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      userPlan = normalizePlan(data?.user?.plan || 'free');
      accountName = String(data?.user?.name || '').trim();
    } catch (err) {
      userPlan = 'free';
    }
  }

  function getDefaultLayoutId() {
    const availableThemes = getAvailableThemesForPlan(userPlan);
    const storedLayoutId = loadSelectedLayoutId();
    const persistedTheme = THEMES[lastTemplateIdx];

    if (canUseDynamicLayout(userPlan) && storedLayoutId === ELITE_DYNAMIC_LAYOUT_ID) {
      return ELITE_DYNAMIC_LAYOUT_ID;
    }

    if (storedLayoutId && availableThemes.some((theme) => theme.id === storedLayoutId)) {
      return storedLayoutId;
    }

    if (persistedTheme && availableThemes.some((theme) => theme.id === persistedTheme.id)) {
      return persistedTheme.id;
    }

    return availableThemes[0] ? availableThemes[0].id : THEMES[0].id;
  }

  function persistSelectedLayout() {
    saveSelectedLayoutId(selectedLayoutId);
    lastTemplateIdx = selectedLayoutId === ELITE_DYNAMIC_LAYOUT_ID ? -1 : themeIndexById(selectedLayoutId);
    saveTemplateState();
  }

  function renderLayoutControls() {
    if (!layoutSelect || !layoutHelp) return;

    const availableThemes = getAvailableThemesForPlan(userPlan);
    const currentSelection = availableThemes.some((theme) => theme.id === selectedLayoutId)
      ? selectedLayoutId
      : getDefaultLayoutId();

    selectedLayoutId = currentSelection;
    layoutSelect.innerHTML = availableThemes
      .map((theme) => `<option value="${theme.id}">${escapeHtml(theme.name)}</option>`)
      .join('');

    if (canUseDynamicLayout(userPlan)) {
      layoutSelect.insertAdjacentHTML('beforeend', `<option value="${ELITE_DYNAMIC_LAYOUT_ID}">Elite Dynamic</option>`);
    }

    layoutSelect.value = selectedLayoutId;
    layoutHelp.textContent = getLayoutHelpText(userPlan);

    if (refreshLayoutBtn) {
      refreshLayoutBtn.style.display = selectedLayoutId === ELITE_DYNAMIC_LAYOUT_ID ? '' : 'none';
    }
  }

  async function initTemplateState() {
    loadTemplateState();
    await loadTemplateStateFromServer();
    await loadCurrentPlan();
    selectedLayoutId = getDefaultLayoutId();
    renderLayoutControls();
  }

  templateStateReadyPromise = initTemplateState();

  function cleanCandidateName(value) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (/candidate name/i.test(cleaned)) return '';
    if (RESUME_SECTION_HEADERS.has(cleaned.replace(/[:\-]/g, '').trim().toUpperCase())) return '';
    return cleaned;
  }

  function isLikelyNameLine(line) {
    const value = cleanCandidateName(line);
    if (!value) return false;
    if (/[@\d]/.test(value)) return false;
    if (/https?:\/\/|www\.|linkedin\.com/i.test(value)) return false;
    if (/^(phone|email|location|contact|profile|summary|experience|education|skills|awards|certifications|projects)\b/i.test(value)) return false;
    if (value.split(/\s+/).length > 5) return false;
    return /^[A-Za-z][A-Za-z\s'.-]+$/.test(value);
  }

  function findNameInLines(lines) {
    const safeLines = (lines || []).map((line) => String(line || '').trim()).filter(Boolean);

    for (let idx = 0; idx < Math.min(safeLines.length, 14); idx += 1) {
      const line = safeLines[idx];
      if (/^name[:\-]?$/i.test(line)) {
        const next = safeLines[idx + 1] || '';
        if (isLikelyNameLine(next)) return cleanCandidateName(next);
      }
      if (isLikelyNameLine(line)) return cleanCandidateName(line);
    }

    return '';
  }

  function extractContactInfo(sourceText) {
    const text = String(sourceText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const phone = (text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) || [])[0] || '';
    const linkedin = (text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i) || [])[0] || '';

    const fullName = findNameInLines(lines);

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
      fullName: cleanCandidateName(fallbackFromBase.fullName) || cleanCandidateName(accountName) || 'Professional Candidate',
      contactLines: [fallbackFromBase.phone, fallbackFromBase.email, fallbackFromBase.location, fallbackFromBase.linkedin].filter(Boolean),
      profile: '',
      experiences: [],
      education: [],
      skills: [],
      awards: []
    };

    const sectionIndex = {
      NAME: -1,
      CONTACT: -1,
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

    const parsedName = sectionIndex.NAME >= 0
      ? between(sectionIndex.NAME, nextSectionStart('NAME'))[0]
      : findNameInLines(lines);

    if (cleanCandidateName(parsedName)) {
      structured.fullName = cleanCandidateName(parsedName);
    }

    structured.profile = between(sectionIndex.PROFILE, nextSectionStart('PROFILE')).join(' ');

    const experienceLines = between(sectionIndex.EXPERIENCE, nextSectionStart('EXPERIENCE'));
    let current = null;
    experienceLines.forEach((line) => {
      const normalized = normalizeBulletText(line);
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

    structured.education = between(sectionIndex.EDUCATION, nextSectionStart('EDUCATION'))
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);
    structured.skills = between(sectionIndex.SKILLS, nextSectionStart('SKILLS'))
      .join(', ')
      .split(/[,|]/)
      .map((s) => normalizeBulletText(s))
      .filter(Boolean)
      .slice(0, 20);
    structured.awards = between(sectionIndex.AWARDS, nextSectionStart('AWARDS'))
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);

    if (!cleanCandidateName(structured.fullName)) {
      structured.fullName = cleanCandidateName(fallbackFromBase.fullName) || cleanCandidateName(accountName) || 'Professional Candidate';
    }

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
    const size = square ? 118 : 108;
    const photoPosition = model.photoPosition || lastPhotoPosition;

    if (model.photoDataUrl) {
      return `<img src="${model.photoDataUrl}" alt="Profile" style="width:${size}px;height:${size}px;object-fit:cover;object-position:${photoPosition.x}% ${photoPosition.y}%;border-radius:${borderRadius};border:2px solid ${theme.accent};display:block;box-shadow:0 8px 22px rgba(15,23,42,0.12);" />`;
    }

    return '';
  }

  function sentenceBullets(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+/)
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);
  }

  function renderBulletListHtml(items, fontSize, color, marginBottom) {
    return (items || []).map((item) => normalizeBulletText(item)).filter(Boolean).map((item) => `
      <div style="display:flex;align-items:flex-start;gap:10px;font-size:${fontSize};line-height:1.6;color:${color};margin-bottom:${marginBottom};font-weight:400;">
        <span style="font-weight:600;line-height:1.2;">•</span>
        <span style="font-weight:400;flex:1;">${escapeHtml(item)}</span>
      </div>
    `).join('');
  }

  function renderSectionHeading(label, theme, fontSize, extraStyles) {
    return `<div style="font-size:${fontSize};font-weight:800;letter-spacing:0.04em;color:${theme.headingText};margin-bottom:10px;${extraStyles || ''}">${label}</div>`;
  }

  function renderTemplateForest(model, theme) {
    const name = splitName(model.fullName);
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup(model, theme, false);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:${theme.primary};padding:24px 28px;color:${theme.headerText};display:flex;gap:18px;align-items:center;">
          ${photoMarkup ? `<div style="flex:0 0 auto;">${photoMarkup}</div>` : ''}
          <div style="flex:1;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.03em;">${escapeHtml((name.first + ' ' + name.rest).trim().toUpperCase())}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;opacity:0.92;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="padding:24px 20px;background:${theme.sidebarBg};border-right:1px solid #e5e7eb;">
            ${renderSectionHeading('CONTACT', theme, '15px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '13px', '#1f2937', '6px')}
            ${renderSectionHeading('CERTIFICATIONS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '13px', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px 28px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '14px', '#374151', '8px')}
            <hr style="border:none;border-top:1px solid #d1d5db;margin:18px 0;" />
            ${renderSectionHeading('EXPERIENCE', theme, '16px')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:6px;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '14px', '#374151', '6px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin-top:14px;')}
            ${renderBulletListHtml(model.education || [], '14px', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateGold(model, theme) {
    const name = splitName(model.fullName);
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup(model, theme, true);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:24px 20px;color:#fff;min-height:100%;">
            ${photoMarkup ? `<div style="display:flex;justify-content:center;margin:0 0 20px 0;">${photoMarkup}</div>` : ''}
            ${renderSectionHeading('CONTACT', { ...theme, headingText: '#ffffff' }, '15px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', { ...theme, headingText: '#ffffff' }, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '13px', '#ffffff', '6px')}
            ${renderSectionHeading('EDUCATION', { ...theme, headingText: '#ffffff' }, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml(model.education || [], '13px', '#ffffff', '6px')}
          </aside>
          <section style="padding:26px 28px;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;color:#111827;">${escapeHtml(name.first)}<span style="font-weight:500;">${escapeHtml(name.rest ? ' ' + name.rest : '')}</span></div>
            <div style="font-size:18px;color:#4b5563;font-weight:600;margin:8px 0 18px 0;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '14px', '#4b5563', '8px')}

            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin-top:18px;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:6px;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '14px', '#374151', '6px')}
              </div>
            `).join('')}

            ${renderSectionHeading('CERTIFICATIONS', theme, '16px', 'margin-top:14px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '14px', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateSlate(model, theme) {
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup(model, theme, false);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:linear-gradient(110deg, ${theme.primary}, ${theme.accent});padding:24px 28px;color:${theme.headerText};display:flex;align-items:center;gap:18px;">
          ${photoMarkup || ''}
          <div>
            <div style="font-size:36px;font-weight:800;line-height:1.05;letter-spacing:0.03em;">${escapeHtml(model.fullName.toUpperCase())}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:24px 20px;border-right:1px solid #d1d5db;">
            ${renderSectionHeading('CONTACT', theme, '15px', 'margin-bottom:8px;')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin:22px 0 8px 0;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 9), '13px', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px', 'margin-bottom:8px;')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '14px', '#374151', '8px')}
            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin:18px 0 8px 0;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:600;color:#111827;margin-bottom:6px;">${escapeHtml(exp.heading)}</div>
                ${renderBulletListHtml(exp.bullets || [], '14px', '#374151', '6px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderBulletListHtml(model.education || [], '14px', '#374151', '6px')}
            ${renderSectionHeading('AWARDS', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '14px', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderResumeTemplate(model) {
    const theme = model.theme || THEMES[0];
    if (theme.layoutType === 'gold') return renderTemplateGold(model, theme);
    if (theme.layoutType === 'slate') return renderTemplateSlate(model, theme);
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

  function resolveSelectedTheme() {
    if (selectedLayoutId === ELITE_DYNAMIC_LAYOUT_ID && canUseDynamicLayout(userPlan)) {
      return createDynamicEliteTheme();
    }

    const availableThemes = getAvailableThemesForPlan(userPlan);
    return availableThemes.find((theme) => theme.id === selectedLayoutId) || availableThemes[0] || THEMES[0];
  }

  function rerenderCurrentResume() {
    if (!lastStructuredResume) return;
    lastStructuredResume = {
      ...lastStructuredResume,
      photoDataUrl: lastPhotoDataUrl,
      photoPosition: { ...lastPhotoPosition },
      theme: resolveSelectedTheme()
    };
    output.innerHTML = renderResumeTemplate(lastStructuredResume);
  }

  function resetPhotoSelection() {
    lastPhotoDataUrl = '';
    lastPhotoPosition = { x: 50, y: 35 };
    if (photoInput) photoInput.value = '';
    renderPhotoPreview();
  }

  function renderPhotoPreview() {
    if (!photoPreview) return;

    if (!lastPhotoDataUrl) {
      photoPreview.innerHTML = '<div style="font-size:0.92rem;color:#64748b;">No photo selected. Your resume will use the clean no-photo layout.</div>';
      if (photoControls) photoControls.style.display = 'none';
      if (photoActions) photoActions.style.display = 'none';
      if (lastStructuredResume && lastRawResume) rerenderCurrentResume();
      return;
    }

    if (photoXInput) photoXInput.value = String(lastPhotoPosition.x);
    if (photoYInput) photoYInput.value = String(lastPhotoPosition.y);
    if (photoControls) photoControls.style.display = '';
    if (photoActions) photoActions.style.display = 'flex';

    photoPreview.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="width:104px;height:104px;border-radius:999px;overflow:hidden;border:2px solid #d1d5db;background:#e2e8f0;flex:0 0 auto;">
          <img src="${lastPhotoDataUrl}" alt="Photo preview" style="width:100%;height:100%;object-fit:cover;object-position:${lastPhotoPosition.x}% ${lastPhotoPosition.y}%;display:block;" />
        </div>
        <div style="font-size:0.92rem;color:#64748b;max-width:320px;">Adjust the sliders until your face is centered. The updated framing will be used in the generated resume design.</div>
      </div>
    `;

    if (lastStructuredResume && lastRawResume) rerenderCurrentResume();
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
    return {
      ...structured,
      targetRole,
      photoDataUrl: lastPhotoDataUrl,
      photoPosition: { ...lastPhotoPosition },
      theme: resolveSelectedTheme()
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
      const cleanSkill = normalizeBulletText(skill);
      if (!cleanSkill) return;
      const wrapped = doc.splitTextToSize(`• ${cleanSkill}`, leftW - 4);
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
      const cleanLine = normalizeBulletText(line);
      if (!cleanLine) return;
      wrapped = doc.splitTextToSize(`• ${cleanLine}`, rightW);
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
        const cleanBullet = normalizeBulletText(bullet);
        if (!cleanBullet) return;
        const bulletWrapped = doc.splitTextToSize(`• ${cleanBullet}`, rightW);
        doc.text(bulletWrapped, rightX, rightY);
        rightY += bulletWrapped.length * 4.2;
      });
      rightY += 2;
    });

    drawTitle('EDUCATION');
    (model.education || []).forEach((line) => {
      const cleanLine = normalizeBulletText(line);
      if (!cleanLine) return;
      wrapped = doc.splitTextToSize(`• ${cleanLine}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    rightY += 2;
    drawTitle('CERTIFICATIONS');
    (model.awards.length ? model.awards : ['N/A']).forEach((line) => {
      const cleanLine = normalizeBulletText(line);
      if (!cleanLine) return;
      wrapped = doc.splitTextToSize(`• ${cleanLine}`, rightW);
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

    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
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
      resetPhotoSelection();
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      lastPhotoDataUrl = '';
      if (photoControls) photoControls.style.display = 'none';
      if (photoActions) photoActions.style.display = 'none';
      photoPreview.innerHTML = '<div style="color:#dc2626;font-size:0.9rem;">Use JPG, PNG, or WEBP.</div>';
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      lastPhotoDataUrl = String(reader.result || '');
      lastPhotoPosition = { x: 50, y: 35 };
      renderPhotoPreview();
    };
    reader.readAsDataURL(file);
  });

  photoReplaceBtn?.addEventListener('click', function () {
    if (photoInput) {
      photoInput.value = '';
      photoInput.click();
    }
  });

  photoRemoveBtn?.addEventListener('click', function () {
    resetPhotoSelection();
  });

  photoXInput?.addEventListener('input', function (event) {
    lastPhotoPosition.x = Number(event.target.value);
    renderPhotoPreview();
  });

  photoYInput?.addEventListener('input', function (event) {
    lastPhotoPosition.y = Number(event.target.value);
    renderPhotoPreview();
  });

  resumeUploadInput?.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    await loadResumeFileIntoField(file, document.getElementById('resumeBaseGen'), resumeUploadMessage);
  });

  layoutSelect?.addEventListener('change', function (event) {
    selectedLayoutId = String(event.target.value || '');
    persistSelectedLayout();
    renderLayoutControls();
    rerenderCurrentResume();
  });

  refreshLayoutBtn?.addEventListener('click', function () {
    if (selectedLayoutId !== ELITE_DYNAMIC_LAYOUT_ID) return;
    rerenderCurrentResume();
    statusBanner('Elite layout refreshed.', true);
  });

  generateBtn?.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const baseResume = document.getElementById('resumeBaseGen').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescriptionGen').value.trim();

    if (!jobTitle || !baseResume || !fullJobDescription) {
      renderError('Please add the job title, your resume, and the full job description.');
      return;
    }

    output.innerHTML = '<div style="color:#2563eb;">Generating resume...</div>';

    try {
      if (templateStateReadyPromise) await templateStateReadyPromise;

      const jobDescription = [
        `Job Title: ${jobTitle}`,
        company ? `Company: ${company}` : '',
        '',
        'Full Job Description:',
        fullJobDescription
      ].filter(Boolean).join('\n');
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
      statusBanner('Resume generated. You can switch layouts, adjust the photo, or download it as Word or PDF.', true);

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

  renderPhotoPreview();
});
