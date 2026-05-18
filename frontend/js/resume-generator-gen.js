document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const previewBtn = document.getElementById('previewResumeBtnGen');
  const clearFieldsBtn = document.getElementById('clearResumeFieldsBtnGen');
  const savePdfBtn = document.getElementById('saveResumePdfBtnGen');
  const saveWordBtn = document.getElementById('saveResumeWordBtnGen');
  const sendEmailBtn = document.getElementById('sendResumeEmailBtnGen');
  const output = document.getElementById('resumeOutputGen');
  const previewModal = document.getElementById('previewModalGen');
  const closePreviewModalBtn = document.getElementById('closePreviewModalGen');
  const closePreviewBtn = document.getElementById('closePreviewBtnGen');
  const previewContent = document.getElementById('previewContentGen');
  const resumeUploadInput = document.getElementById('resumeBaseUploadGen');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessageGen');
  const billingPanel = document.getElementById('resumeBillingPanel');
  const billingStatus = document.getElementById('resumeBillingStatus');
  const buySingleBtn = document.getElementById('resumeBuySingleBtn');
  const buyFiveBtn = document.getElementById('resumeBuyFiveBtn');
  const buyTenBtn = document.getElementById('resumeBuyTenBtn');
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
  const linkedinAdoptPanel = document.getElementById('resumeLinkedinAdoptPanelGen');

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
  const BLANK_LAYOUT_ID = 'blank-template';
  const RESUME_SECTION_HEADERS = new Set(['NAME', 'CONTACT', 'PROFILE', 'SUMMARY', 'EXPERIENCE', 'EDUCATION', 'SKILLS', 'AWARDS', 'CERTIFICATION', 'CERTIFICATIONS', 'IMPROVEMENTS', 'PROJECTS']);
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
  let currentUserPreferredLocation = '';
  let currentUserProfileSummary = '';
  let selectedLayoutId = '';
  let templateQueue = [];
  let lastTemplateIdx = -1;
  let latestLearningRoadmapText = '';
  let learningRoadmapAppliedFromSession = false;
  let resumeCreditStatus = null;
  const templateStateKey = `resume-template-queue-v1-${THEMES.map((t) => t.id).join('|')}`;
  const layoutSelectionKey = 'resume-layout-selection-v2';
  const draftStorageKey = 'resume-generator-draft-v1';
  const selectedLearningRoadmapKey = 'learning-selected-roadmap-v1';
  let templateStateReadyPromise = null;
  const pageQueryParams = new URLSearchParams(window.location.search);
  const isWhatsAppSourceFlow = String(pageQueryParams.get('source') || '').toLowerCase() === 'whatsapp';

  function getAuthToken() {
    if (typeof getStoredToken === 'function') {
      const stored = getStoredToken();
      if (stored) return stored;
    }

    return (
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('rr_token') ||
      sessionStorage.getItem('rr_token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('authToken') ||
      ''
    );
  }

  function getApiEndpoint(path) {
    if (typeof apiUrl === 'function') return apiUrl(path);
    return path;
  }

  function setBillingButtonsDisabled(disabled) {
    [buySingleBtn, buyFiveBtn, buyTenBtn].forEach((btn) => {
      if (!btn) return;
      btn.disabled = disabled;
    });
  }

  function setBillingButtonsVisible(visible) {
    [buySingleBtn, buyFiveBtn, buyTenBtn].forEach((btn) => {
      if (!btn) return;
      btn.style.display = visible ? '' : 'none';
    });
  }

  function renderResumeCreditStatus(status) {
    if (!billingPanel || !billingStatus) return;
    resumeCreditStatus = status || null;

    if (!status) {
      billingStatus.textContent = 'Could not load your document credit status.';
      return;
    }

    if (status.unlimited) {
      billingStatus.textContent = 'Your current plan includes unlimited resume generations.';
      setBillingButtonsDisabled(true);
      setBillingButtonsVisible(false);
      return;
    }

    const freeLabel = status.freeRemaining > 0 ? '1 free daily generation remaining' : 'Free daily generation already used';
    const remainingCredits = Number(status.paidCredits || 0);
    const purchasedCredits = Number(status.totalCreditsPurchased || 0);
    const usedCredits = Number(status.usedCredits || Math.max(0, purchasedCredits - remainingCredits));
    const creditLabel = `${remainingCredits} paid credit${remainingCredits === 1 ? '' : 's'} available`;
    const activityLabel = purchasedCredits > 0
      ? `Purchased ${purchasedCredits} total, ${usedCredits} used`
      : 'No paid purchases yet';
    billingStatus.textContent = `${freeLabel}. ${creditLabel}. ${activityLabel}.`;
    setBillingButtonsDisabled(false);
    setBillingButtonsVisible(true);
  }

  async function loadResumeCreditStatus() {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Please log in to load your credit balance.');
    }
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch(getApiEndpoint('/api/document-credits/status?feature=resume'), { headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not load billing status.');
    }
    renderResumeCreditStatus(data.status || null);
    return data.status || null;
  }

  async function startCreditCheckout(bundle) {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    setBillingButtonsDisabled(true);
    try {
      const response = await fetch(getApiEndpoint('/api/document-credits/create-checkout-session'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bundle,
          returnPath: '/resume-generator.html'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout.');
      }

      // Store a same-origin return target so in-page back does not bounce to Stripe.
      try {
        const returnUrl = new URL(window.location.href);
        returnUrl.searchParams.delete('docCredits');
        returnUrl.searchParams.delete('session_id');
        returnUrl.searchParams.delete('rr_restore');
        sessionStorage.setItem('rr:return:url', `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`);
      } catch (err) {
        // Ignore storage/URL parsing issues and continue to checkout.
      }

      window.location.href = data.url;
    } catch (error) {
      statusBanner(error.message || 'Could not start checkout.', false);
      setBillingButtonsDisabled(false);
    }
  }

  async function confirmDocumentCheckoutSession(sessionId) {
    const id = String(sessionId || '').trim();
    if (!id) return;
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      await fetch(getApiEndpoint('/api/stripe/confirm-checkout-session'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId: id })
      });
    } catch (_) {
      // Silent fallback: the status poll will keep trying.
    }
  }

  function normalizePlan(plan) {
    const normalized = String(plan || 'free').toLowerCase();
    return PLAN_LAYOUT_LIMITS[normalized] ? normalized : 'free';
  }

  function canPreviewResume(plan) {
    return normalizePlan(plan) !== 'free';
  }

  function getThemeLimitForPlan(plan) {
    return PLAN_LAYOUT_LIMITS[normalizePlan(plan)] || 1;
  }

  function canUseDynamicLayout(plan) {
    const normalized = normalizePlan(plan);
    return normalized === 'elite' || normalized === 'lifetime';
  }

  function getAvailableThemesForPlan(plan) {
    const blankTheme = {
      id: BLANK_LAYOUT_ID,
      name: 'Blank Template',
      layoutType: 'blank',
      primary: '#000000',
      accent: '#666666',
      sidebarBg: '#ffffff',
      headerText: '#000000',
      headingText: '#000000',
      font: 'Arial, sans-serif'
    };
    return [blankTheme, ...THEMES.slice(0, getThemeLimitForPlan(plan))];
  }

  function getLayoutHelpText(plan) {
    const normalized = normalizePlan(plan);
    if (normalized === 'free') return 'Free includes 1 layout.';
    if (normalized === 'pro') return 'Pro unlocks 3 layouts.';
    if (normalized === 'premium') return 'Premium unlocks 9 layouts.';
    return 'Elite unlocks all 9 layouts plus unlimited dynamic refreshes.';
  }

  function updateResumeTierTitle(plan) {
    const tierTitleEl = document.getElementById('resumeTierTitle');
    if (!tierTitleEl) return;
    
    const normalized = normalizePlan(plan);
    const tierLabels = {
      free: 'Free Tier: First daily resume is free',
      pro: 'Pro Tier: Unlimited resumes available',
      premium: 'Premium Tier: Unlimited resumes available',
      elite: 'Elite Tier: Unlimited resumes available',
      lifetime: 'Lifetime Tier: Unlimited resumes available'
    };
    
    tierTitleEl.textContent = tierLabels[normalized] || tierLabels.free;
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

  function readDraftState() {
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function saveDraftState() {
    try {
      const payload = {
        jobTitle: document.getElementById('resumeJobTitleGen')?.value || '',
        company: document.getElementById('resumeCompanyGen')?.value || '',
        baseResume: document.getElementById('resumeBaseGen')?.value || '',
        jobDescription: document.getElementById('resumeJobDescriptionGen')?.value || '',
        updatedAt: Date.now()
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    } catch (err) {
      // Ignore storage issues.
    }
  }

  function clearDraftState() {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch (err) {
      // Ignore storage issues.
    }
  }

  function restoreDraftState() {
    const draft = readDraftState();
    if (!draft) return;

    const jobTitleInput = document.getElementById('resumeJobTitleGen');
    const companyInput = document.getElementById('resumeCompanyGen');
    const baseResumeInput = document.getElementById('resumeBaseGen');
    const jobDescriptionInput = document.getElementById('resumeJobDescriptionGen');

    if (jobTitleInput && !jobTitleInput.value && draft.jobTitle) jobTitleInput.value = String(draft.jobTitle);
    if (companyInput && !companyInput.value && draft.company) companyInput.value = String(draft.company);
    if (baseResumeInput && !baseResumeInput.value && draft.baseResume) baseResumeInput.value = String(draft.baseResume);
    if (jobDescriptionInput && !jobDescriptionInput.value && draft.jobDescription) jobDescriptionInput.value = String(draft.jobDescription);
  }

  function attachDraftPersistence() {
    const watchedIds = ['resumeJobTitleGen', 'resumeCompanyGen', 'resumeBaseGen', 'resumeJobDescriptionGen'];
    watchedIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', saveDraftState);
      el.addEventListener('change', saveDraftState);
      el.addEventListener('input', renderLinkedinAdoptionInsights);
      el.addEventListener('change', renderLinkedinAdoptionInsights);
    });
  }

  function renderLinkedinAdoptionInsights() {
    if (!linkedinAdoptPanel) return;

    // This panel was surfacing noisy guidance unrelated to final resume output.
    // Keep it hidden so the generator focuses only on resume content.
    linkedinAdoptPanel.style.display = 'none';
    linkedinAdoptPanel.innerHTML = '';
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

  function toTitleCaseName(fullName) {
    const words = String(fullName || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!words.length) return '';

    const titleToken = (token) => token
      .split('-')
      .map((part) => part
        .split("'")
        .map((piece) => {
          if (!piece) return piece;
          // Preserve all-caps abbreviations (e.g. MBA, RN, ARRT)
          if (/^[A-Z]{2,6}$/.test(piece)) return piece;
          // Preserve credential/abbreviation tokens that contain dots or parentheses (e.g. R.T.(R), Ph.D., (ARRT))
          if (/[.(]/.test(piece) || /^\(/.test(piece)) return piece;
          return piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase();
        })
        .join("'"))
      .join('-');

    return words.map(titleToken).join(' ');
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
      await fetch(getApiEndpoint('/api/resume/template-state'), {
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
      const res = await fetch(getApiEndpoint('/api/resume/template-state'), {
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
      const res = await fetch(getApiEndpoint('/api/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      userPlan = normalizePlan(data?.user?.plan || 'free');
      accountName = String(data?.user?.name || '').trim();
      currentUserPreferredLocation = String(data?.user?.jobAlertDefaults?.location || '').trim();
      currentUserProfileSummary = String(data?.user?.networkingProfile?.bio || '').trim();
    } catch (err) {
      userPlan = 'free';
    }
  }

  async function loadLatestLearningRoadmap() {
    const token = getAuthToken();
    if (!token) {
      latestLearningRoadmapText = '';
      return;
    }

    try {
      const res = await fetch(getApiEndpoint('/api/learning/latest'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      latestLearningRoadmapText = String(data?.roadmap?.roadmapText || '').trim().slice(0, 1500);
    } catch (err) {
      latestLearningRoadmapText = '';
    }
  }

  function loadSelectedLearningRoadmapFromSession() {
    try {
      const raw = sessionStorage.getItem(selectedLearningRoadmapKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const selectedRoadmap = String(parsed?.roadmapText || '').trim();
      const selectedRole = String(parsed?.targetRole || '').trim();
      let applied = false;
      if (selectedRoadmap) {
        latestLearningRoadmapText = selectedRoadmap.slice(0, 1500);
        applied = true;
      }
      if (selectedRole) {
        const roleInput = document.getElementById('resumeJobTitleGen');
        if (roleInput && !roleInput.value.trim()) {
          roleInput.value = capitalizeJobTitle(selectedRole);
          applied = true;
        }
      }
      sessionStorage.removeItem(selectedLearningRoadmapKey);
      return applied;
    } catch (err) {
      // Ignore storage parse errors.
      return false;
    }
  }

  function withLearningContext(jobDescriptionText) {
    const jd = String(jobDescriptionText || '').trim();
    if (!latestLearningRoadmapText) return jd;
    return [
      jd,
      '',
      'Learning Roadmap Insights:',
      latestLearningRoadmapText
    ].join('\n');
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

  function updatePreviewAccess() {
    if (!previewBtn) return;
    previewBtn.style.display = canPreviewResume(userPlan) ? '' : 'none';
  }

  async function initTemplateState() {
    loadTemplateState();
    await loadTemplateStateFromServer();
    await loadCurrentPlan();
    updateResumeTierTitle(userPlan);
    await loadLatestLearningRoadmap();
    learningRoadmapAppliedFromSession = loadSelectedLearningRoadmapFromSession();
    selectedLayoutId = getDefaultLayoutId();
    renderLayoutControls();
    updatePreviewAccess();
  }

  templateStateReadyPromise = initTemplateState();

  function cleanCandidateName(value) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (/candidate name/i.test(cleaned)) return '';
    if (RESUME_SECTION_HEADERS.has(cleaned.replace(/[:\-]/g, '').trim().toUpperCase())) return '';
    return cleaned;
  }

  function normalizeNameCandidate(value) {
    let cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';

    cleaned = cleaned.replace(/^name\s*[:\-]?\s*/i, '').trim();
    cleaned = cleaned.split('|')[0].trim();

    cleaned = cleaned
      .replace(/[,|]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanCandidateName(cleaned);
  }

  function isLikelyRoleTitle(value) {
    return /^(project|program|product|operations|construction|mechanical|software|systems)?\s*(manager|engineer|director|analyst|consultant|specialist|coordinator|supervisor|lead)\b/i.test(String(value || '').trim());
  }

  function isLikelyNameLine(line) {
    const value = normalizeNameCandidate(line);
    if (!value) return false;
    if (isLikelyRoleTitle(value)) return false;
    if (/[@\d]/.test(value)) return false;
    if (/https?:\/\/|www\.|linkedin\.com/i.test(value)) return false;
    if (/^(phone|email|location|contact|profile|summary|experience|education|skills|awards|certifications|projects)\b/i.test(value)) return false;
    // Strip credential suffixes like R.T.(R), ARRT, CPA before word-count check
    const nameCore = value.split(',')[0].replace(/[()®™\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    if (nameCore.split(/\s+/).length > 6) return false;
    // Allow credential chars: parentheses, commas, registered marks
    return /^[A-Za-z][A-Za-z\s'.,()\-®™]+$/.test(value);
  }

  function findNameInLines(lines) {
    const safeLines = (lines || []).map((line) => String(line || '').trim()).filter(Boolean);

    for (let idx = 0; idx < Math.min(safeLines.length, 14); idx += 1) {
      const line = safeLines[idx];
      if (/^name[:\-]?$/i.test(line)) {
        const next = safeLines[idx + 1] || '';
        if (isLikelyNameLine(next)) return normalizeNameCandidate(next);
      }
      if (isLikelyNameLine(line)) return normalizeNameCandidate(line);
    }

    return '';
  }

  function hasDateRangeToken(value) {
    const text = String(value || '');
    // Matches: 1/2023, 11/2023, 2015, 2015-2022, 2015 – Present, Jan 2021 – Nov 2023, Present/Current/Now
    return /\b\d{1,2}\/\d{3,4}\b/.test(text)
      || /\b(present|current|in progress|now)\b/i.test(text)
      || /\b\d{4}\s*[-–]\s*(\d{4}|present|current|now)\b/i.test(text)
      || /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[^,\n]*\d{4}/i.test(text);
  }

  function isLikelyContactLocationLine(value) {
    const line = normalizeBulletText(value);
    if (!line) return false;
    if (!/,\s*[A-Z]{2}\b/.test(line)) return false;
    if (hasDateRangeToken(line)) return false;
    if (isLikelyExperienceHeaderLine(line)) return false;
    if (/https?:\/\/|www\.|linkedin\.com|@/i.test(line)) return false;
    return true;
  }

  function isResumeSpilloverLine(value) {
    const line = normalizeBulletText(value);
    if (!line) return true;

    if (/^(contact|key skills|skills|education|certifications?|awards|profile|summary|experience)\b/i.test(line)) {
      return true;
    }

    if (/(contact|key skills|city:|state:|zip|email@example\.com|phone|email)/i.test(line) && /[A-Za-z]/.test(line)) {
      return true;
    }

    return false;
  }

  function isLikelyExperienceHeaderLine(value) {
    const line = normalizeBulletText(value);
    if (!line) return false;
    if (/^(experience|education|skills|core skills|certification|certifications|profile|summary|awards|projects)\b/i.test(line)) return false;

    const hasRoleAndCompanyShape = /^[A-Z][A-Za-z.&\-\s]+,\s*[A-Z][A-Za-z0-9.&'\-\s]+,/.test(line);
    const hasLocationSignal = /,\s*[A-Z]{2}\b/.test(line) || /\b(U\.S\.?\s*Army|Reserves?|Company|Healthcare|Inc|LLC|University)\b/i.test(line);
    const hasDateSignal = hasDateRangeToken(line);

    return hasRoleAndCompanyShape && (hasLocationSignal || hasDateSignal);
  }

  function joinMultilineBullets(lines) {
    const result = [];
    let currentBullet = '';

    for (const rawLine of (lines || [])) {
      const line = String(rawLine || '').trim();
      if (!line) continue;

      if (isResumeSpilloverLine(line)) {
        if (currentBullet) {
          result.push(currentBullet);
          currentBullet = '';
        }
        continue;
      }

      // Check if this line starts a new bullet or is a header/section
      const startsNewBullet = /^(•|[-*]|\d+[\.\)])\s/.test(line) || isLikelyExperienceHeaderLine(line);

      if (startsNewBullet) {
        // If we have a current bullet, save it
        if (currentBullet) {
          result.push(currentBullet);
        }
        // Start a new bullet
        currentBullet = line;
      } else if (currentBullet) {
        // This is a continuation line - append it with a space
        currentBullet += ' ' + line;
      } else if (line) {
        // No current bullet but have text - start one
        currentBullet = line;
      }
    }

    // Don't forget the last bullet
    if (currentBullet) {
      result.push(currentBullet);
    }

    return result;
  }

  // Parses experience entries from resume body where there is NO explicit "EXPERIENCE"
  // section heading — handles "Company Name   2015-2022", "Company   Jan 2020 – Present", etc.
  function parseExperienceEntriesFromBody(lines) {
    const companyDateRx = /^(.+?)\s{2,}((?:\d{1,2}\/\d{2,4}|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})\s*(?:[-–to]+\s*(?:\d{1,2}\/\d{2,4}|\d{4}|present|current|now))?)$/i;
    const sectionBoundaryRx = /^(education|skills|core skills|certification|certifications|profile|summary|awards|projects)\b/i;

    const entries = [];
    let current = null;

    for (const rawLine of (lines || [])) {
      const line = rawLine.trim();
      if (!line) continue;

      if (isResumeSpilloverLine(line)) continue;

      if (sectionBoundaryRx.test(line)) break;

      const dateMatch = line.match(companyDateRx);
      if (dateMatch && line.length > 15) {
        // This is a company + date header line
        if (current) entries.push(current);
        const companyRaw = normalizeBulletText(dateMatch[1]);
        const dateSuffix = line.slice(dateMatch[1].length).trim();
        current = {
          title: '',       // next non-blank line becomes the role title
          company: dateSuffix ? `${companyRaw}  ${dateSuffix}` : companyRaw,
          bullets: []
        };
        continue;
      }

      if (current) {
        if (!current.title) {
          // First line after company header = role title
          current.title = normalizeBulletText(line);
        } else {
          current.bullets.push(normalizeBulletText(line));
        }
      }
    }

    if (current) entries.push(current);

    return entries
      .map((e) => ({
        ...e,
        title: normalizeBulletText(e.title),
        company: normalizeBulletText(e.company),
        bullets: (e.bullets || []).map((b) => normalizeBulletText(b)).filter(Boolean)
      }))
      .filter((e) => e.title);
  }

  function parseExperienceEntries(lines) {
    // First, join multi-line bullets back together
    const joinedLines = joinMultilineBullets(lines);
    
    const entries = [];
    let current = null;
    let pendingDateLine = '';

    for (const rawLine of (joinedLines || [])) {
      const line = normalizeBulletText(rawLine);
      if (!line) continue;

      if (isResumeSpilloverLine(line)) continue;

      if (isLikelyExperienceHeaderLine(line)) {
        if (current) entries.push(current);
        current = { title: line, company: '', bullets: [] };
        pendingDateLine = '';
        continue;
      }

      if (current && !current.company && hasDateRangeToken(line) && line.length <= 40) {
        current.company = line;
        pendingDateLine = line;
        continue;
      }

      if (!current) {
        current = { title: line, company: '', bullets: [] };
        continue;
      }

      const isSectionBoundary = /^(education|skills|core skills|certification|certifications|profile|summary|awards|projects)\b/i.test(line);
      if (isSectionBoundary) break;

      if (pendingDateLine && line === pendingDateLine) continue;
      current.bullets.push(line);
    }

    if (current) entries.push(current);

    return entries
      .map((entry) => ({
        ...entry,
        title: normalizeBulletText(entry.title),
        company: normalizeBulletText(entry.company),
        bullets: (entry.bullets || []).map((b) => normalizeBulletText(b)).filter(Boolean)
      }))
      .filter((entry) => entry.title);
  }

  function mergeExperienceEntries(primaryEntries, fallbackEntries) {
    const kept = (primaryEntries || []).slice();
    const seen = new Set(kept.map((item) => normalizeBulletText(item.title).toLowerCase()));

    for (const entry of (fallbackEntries || [])) {
      const key = normalizeBulletText(entry.title).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      kept.push(entry);
    }

    return kept;
  }

  function extractContactInfo(sourceText) {
    const text = String(sourceText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const phone = (text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) || [])[0] || '';
    const linkedin = (text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i) || [])[0] || '';

    const fullName = findNameInLines(lines);

    const cityStateLine = lines.slice(0, 14).find((line) => isLikelyContactLocationLine(line)) || '';
    return {
      fullName,
      email,
      phone,
      location: cityStateLine,
      linkedin
    };
  }

  function isDegreeLine(line) {
    const text = String(line || '').toLowerCase();
    // Check for degree patterns like "Master of Science", "Bachelor of Arts", etc.
    if (/(master|bachelor|doctor|associate|doctorate)\s+(of|in)\s+(science|arts|engineering|business|applied|administration)/i.test(line)) {
      return true;
    }
    // Check for university/college indicators
    if (/\b(university|college)\b/i.test(line) && !/certified|certificate|professional|exam/i.test(line)) {
      return true;
    }
    // Check for degree abbreviations at the start or standalone
    if (/\b(phd|ms|ma|bs|ba|mba|msem|bse|pe)\b/i.test(line) && !/professional|certification|exam/i.test(line)) {
      return true;
    }
    return false;
  }

  function isGenericSkill(skill) {
    const normalized = normalizeBulletText(skill).toLowerCase();
    if (!normalized) return true;
    if (normalized.length > 80) return true; // Too long to be a skill
    if (normalized.length < 3) return true; // Too short
    
    // Filter out company names - very aggressive
    if (/\b(corporation|corp|company|inc\.?|llc|ltd|plc|gmbh|co\.|co|medical center|hospital|university|college|school|healthcare system)\b/i.test(normalized)) {
      return true;
    }
    
    // Filter out very common companies specifically
    if (/^(ibm|accenture|deloitte|mckinsey|goldman|jpmorgan|chase|good samaritan|good samaritan medical center|google|apple|amazon|facebook|meta|netflix|tesla|walmart|target|costco|kroger)$/i.test(normalized)) {
      return true;
    }
    
    // Filter out job titles and roles
    if (/\b(manager|engineer|director|analyst|consultant|specialist|coordinator|supervisor|lead|chief|officer|president|vice|administrator|operator|technician|developer|programmer|architect|designer|author|writer|editor|producer|representative|associate|assistant|intern|trainee|apprentice|student|teacher|instructor|lecturer|professor|doctor|nurse|technologist|executive|leader)\b/i.test(normalized)) {
      return true;
    }
    
    // Filter out dates and date-related text
    if (/\b(\d{1,2}\/\d{3,4}|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|present|current|now|ongoing|today|\d{4}[-–]\d{4}|\d{4}[-–])\b/i.test(normalized)) {
      return true;
    }
    
    // Filter out locations and address-related text
    if (/^[\w\s]*,\s*[A-Z]{2}\b|street|road|avenue|boulevard|drive|court|lane|place|suite|floor|apartment|apt|bldg|building/.test(normalized)) {
      return true;
    }
    
    // Filter out very short generic words
    if (/^(a|an|the|is|are|be|good|bad|ok|yes|no|team|member|person|guy|gal|staff|people|human|work|job|role)$/i.test(normalized)) {
      return true;
    }
    
    // Filter out common generic skills
    return [
      /^team player$/i,
      /^collaborator$/i,
      /^creative thinking$/i,
      /^leadership$/i,
      /^strong work ethic$/i,
      /^interpersonal$/i,
      /^organizational development$/i,
      /^good at/i,
      /^works well with/i,
      /^fast$/i,
      /^experienced in$/i,
      /^some$/i,
      /^working on$/i,
      /^learning$/i,
      /^familiar with$/i,
      /^knowledge of$/i,
      /^proficient in\s*$/i,
      /^manages$/i,
      /^manages and coordinates$/i,
      /^creates and maintains$/i,
      /^establish$/i,
      /^manage and coordinate$/i,
      /^create and maintain$/i,
      /^good samaritan$/i,
      /^medical center$/i,
      /^diagnostic supervisor$/i,
      /^can$/i,
      /^ability$/i,
      /^skills$/i,
      /^experience$/i,
      /^contact$/i,
      /^profile$/i,
      /^(manage|coordinate|maintain|create|lead|develop|implement)/i
    ].some((pattern) => pattern.test(normalized));
  }

  function expandSkillCandidates(rawText) {
    const text = normalizeBulletText(rawText);
    if (!text) return [];

    return text
      .split(/[.!?]\s+/)
      .flatMap((segment) => {
        const cleanedSegment = normalizeBulletText(segment)
          .replace(/^(proficient|skill(?:ed)?|experience|experienced|knowledge(?:able)?|expertise|familiar)\s+(with|in|using|on)\s+/i, '')
          .replace(/^(proficient|skill(?:ed)?|experience|experienced|knowledge(?:able)?|expertise|familiar)\s+in\s+/i, '')
          .trim();

        return cleanedSegment.split(/[,;]/);
      })
      .map((item) => normalizeBulletText(item))
      .map((item) => item.replace(/^\b(in|with|using|on|for)\b\s+/i, '').trim())
      .map((item) => item.replace(/\b(such as|including)\b.*$/i, '').trim())
      .filter(Boolean);
  }

  function isSentenceLikeSkillFragment(skill) {
    const value = String(skill || '').trim();
    if (!value) return true;
    if (value.split(/\s+/).length > 6) return true;
    if (/\b(teaching|mentoring|perform|execute|maintain|managed|manage|coordinate|build|working|works|collaborate|interview|approve|onboard|establish)\b/i.test(value)) return true;
    if (/\b(i|we|they|he|she|our|their|my)\b/i.test(value)) return true;
    return false;
  }

  function isLikelySkill(text) {
    const normalized = String(text || '').toLowerCase().trim();
    if (!normalized || normalized.length < 3 || normalized.length > 100) return false;
    
    // Known skill keywords and patterns
    const skillPatterns = [
      // Programming Languages
      /\b(javascript|typescript|python|java|c\#|c\+\+|ruby|php|swift|kotlin|go|rust|scala|r programming|vb\.net|perl|lua|groovy)\b/i,
      // Web Technologies
      /\b(react|angular|vue|node\.?js|express|django|rails|flask|asp\.net|spring|hibernate|jdbc|jpa)\b/i,
      // Databases
      /\b(sql|mysql|postgresql|oracle|mongodb|cassandra|redis|elasticsearch|dynamodb|firebase|firestore)\b/i,
      // Cloud Platforms
      /\b(aws|azure|gcp|google cloud|heroku|digital ocean|ibm cloud|linode|docker|kubernetes)\b/i,
      // Tools & Frameworks
      /\b(git|jenkins|circleci|travis ci|gitlab ci|github actions|terraform|ansible|chef|puppet|maven|gradle|webpack)\b/i,
      // Microsoft Suite
      /\b(excel|word|powerpoint|outlook|access|project|visio|teams|sharepoint|dynamics|office)\b/i,
      // Adobe Suite
      /\b(photoshop|illustrator|indesign|premiere|after effects|xd|lightroom|dreamweaver|acrobat)\b/i,
      // Data & Analytics
      /\b(tableau|power bi|looker|google analytics|data warehouse|etl|analytics|statistics|ml|machine learning|deep learning|nlp|computer vision)\b/i,
      // Certifications & Credentials
      /\b(pmp|cissp|ccna|aws certified|gcp certified|azure certified|six sigma|scrum|agile|lean|prince2|itil|cia|cpa|cfa|six sigma|black belt|comptia)\b/i,
      // Soft Skills (legitimate ones)
      /\b(project management|team leadership|stakeholder management|strategic planning|business analysis|consulting|negotiation|public speaking|presentation|writing|editing|translation|collaboration|communication|oral communication|written communication|oral and written communication|critical thinking|problem solving|coordination|customer service|scheduling and planning|deadline management|meeting project deadlines|workflow optimization)\b/i,
      // Domain Skills
      /\b(autocad|revit|solidworks|catia|matlab|mathematica|sas|spss|minitab|sap|oracle|salesforce|workday|servicenow|jira|confluence|slack|zoom|salesforce|hubspot)\b/i,
      // Finance & Accounting
      /\b(gaap|ifrs|tax accounting|audit|financial analysis|budget planning|treasury|corporate finance|investment banking|trading|valuation)\b/i,
      // Healthcare
      /\b(ehr|emr|pacs|hitech|hipaa|clinical documentation|icd|cpt|medical coding|ris|his|meditech|epic|cerner|centricity|mckesson|kronos|hologic|ge imaging|ge healthcare)\b/i,
      // Other Technical
      /\b(seo|sem|digital marketing|content marketing|email marketing|crm|marketing automation|social media management|brand management|seo optimization)\b/i,
      // Languages
      /\b(english|spanish|french|german|mandarin|japanese|arabic|portuguese|hindi|russian|korean|italian|dutch|polish|turkish|swedish)\b/i,
      // Operations
      /\b(supply chain|procurement|vendor management|inventory management|logistics|operations management|process improvement|quality assurance|six sigma)\b/i
    ];
    
    return skillPatterns.some(pattern => pattern.test(normalized));
  }

  function normalizeStateAbbreviations(value) {
    return String(value || '').replace(/,\s*([A-Za-z]{2})(?=\b)/g, (_, abbr) => `, ${String(abbr).toUpperCase()}`);
  }

  function capitalizeJobTitle(title) {
    const normalized = String(title || '').trim();
    if (!normalized) return normalized;
    
    // Words that should not be capitalized (unless they're the first word)
    const smallWords = /^(and|or|of|the|a|an|in|on|at|by|for|with|from|to|as|is|are|be|been|being)$/i;
    
    return normalized
      .split(/[\s-]+/)
      .map((word, idx) => {
        if (idx === 0) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        if (smallWords.test(word)) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  function convertTenseToPast(text, jobDateRange) {
    const dateStr = String(jobDateRange || '').toLowerCase();
    const isCurrentJob = /present|current|now|today|ongoing/i.test(dateStr);
    
    if (isCurrentJob) return text; // Keep present tense for current jobs
    
    const normalized = String(text || '');
    const tenseMap = [
      { present: /\bmanage\b/gi, past: 'managed' },
      { present: /\bmanages\b/gi, past: 'managed' },
      { present: /\bcoordinate\b/gi, past: 'coordinated' },
      { present: /\bcoordinates\b/gi, past: 'coordinated' },
      { present: /\bcreate\b/gi, past: 'created' },
      { present: /\bcreates\b/gi, past: 'created' },
      { present: /\bmaintain\b/gi, past: 'maintained' },
      { present: /\bmaintains\b/gi, past: 'maintained' },
      { present: /\bestablish\b/gi, past: 'established' },
      { present: /\bestablishes\b/gi, past: 'established' },
      { present: /\blead\b/gi, past: 'led' },
      { present: /\bleads\b/gi, past: 'led' },
      { present: /\bimplement\b/gi, past: 'implemented' },
      { present: /\bimplements\b/gi, past: 'implemented' },
      { present: /\bdesign\b/gi, past: 'designed' },
      { present: /\bdesigns\b/gi, past: 'designed' },
      { present: /\bdevelop\b/gi, past: 'developed' },
      { present: /\bdevelops\b/gi, past: 'developed' },
      { present: /\banalyze\b/gi, past: 'analyzed' },
      { present: /\banalyzes\b/gi, past: 'analyzed' },
      { present: /\bidentify\b/gi, past: 'identified' },
      { present: /\bidentifies\b/gi, past: 'identified' },
      { present: /\bsolve\b/gi, past: 'solved' },
      { present: /\bsolves\b/gi, past: 'solved' },
      { present: /\bimprove\b/gi, past: 'improved' },
      { present: /\bimproves\b/gi, past: 'improved' },
      { present: /\boptimize\b/gi, past: 'optimized' },
      { present: /\boptimizes\b/gi, past: 'optimized' },
      { present: /\btraining\b/gi, past: 'trained' },
      { present: /\btrain\b/gi, past: 'trained' },
      { present: /\bcoordinating\b/gi, past: 'coordinated' },
      { present: /\bmanaging\b/gi, past: 'managed' },
      { present: /\boverseeing\b/gi, past: 'oversaw' },
      { present: /\boversee\b/gi, past: 'oversaw' }
    ];
    
    let result = normalized;
    for (const { present, past } of tenseMap) {
      result = result.replace(present, past);
    }
    
    return result;
  }

  function processExperienceForRender(experience) {
    const normalizeCompanyDateLine = (value) => {
      let text = normalizeBulletText(value);
      if (!text) return '';

      text = text.replace(/\s*\|\s*(?=((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}|\d{4}|present|current|now))/gi, ' | ');
      text = text.replace(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}|\d{4}|present|current|now)\b/gi, '$1 - $2');
      text = text.replace(/\b(\d{4})\s+(\d{4}|present|current|now)\b/gi, '$1 - $2');
      return normalizeStateAbbreviations(text);
    };

    return {
      ...experience,
      title: capitalizeJobTitle(experience.title || ''),
      company: normalizeCompanyDateLine(experience.company || ''),
      bullets: (experience.bullets || [])
        .map((bullet) => normalizeBulletText(bullet))
        .filter((bullet) => bullet && !isResumeSpilloverLine(bullet))
        .map((bullet) => convertTenseToPast(bullet, experience.company || ''))
    };
  }

  function filterAndCleanSkills(skillLines) {
    const skills = [];
    
    for (const line of (skillLines || [])) {
      const candidates = expandSkillCandidates(line);
      for (const candidate of candidates) {
        // Skip if it's a generic/invalid skill
        if (isGenericSkill(candidate)) continue;
        if (isSentenceLikeSkillFragment(candidate)) continue;
        if (!isLikelySkill(candidate)) continue;

        // Clean up common prefixes
        let cleanedSkill = candidate
        .replace(/^proficient in\s+/i, '')
        .replace(/^skilled in\s+/i, '')
        .replace(/^experience with\s+/i, '')
        .replace(/^experience in\s+/i, '')
        .replace(/^knowledgeable in\s+/i, '')
        .replace(/^familiar with\s+/i, '')
        .replace(/^expertise in\s+/i, '')
        .trim();

        // Remove trailing dates or qualifiers
        cleanedSkill = cleanedSkill.replace(/\s*\d{1,2}\/\d{3,4}.*$/i, '').trim();
        cleanedSkill = cleanedSkill.replace(/\s*\(\d{4}[-–]\d{4}\).*$/i, '').trim();

        if (cleanedSkill && cleanedSkill.length > 2 && cleanedSkill.length < 80) {
          if (!skills.includes(cleanedSkill)) {
            skills.push(cleanedSkill);
          }
        }
      }
    }
    
    return skills.slice(0, 20);
  }

  function shouldRelocateSkillSentence(sentence) {
    const normalized = normalizeBulletText(sentence);
    if (!normalized) return false;

    // Relocate only explicit skill-declaration sentences.
    if (!/\b(skill(?:ed)?|proficient|experience|familiar|knowledge(?:able)?|expertise)\b/i.test(normalized)) {
      return false;
    }

    const extracted = filterAndCleanSkills([normalized]);
    if (!extracted.length) return false;

    // Keep accomplishment-oriented bullets in experience unless they are clearly skill declarations.
    const hasActionContent = /\b(managed|manage|coordinated|coordinate|created|create|established|establish|interview|onboard|approve|approved|collaborate|collaborated|teach|teaching|mentor|mentoring|performed|perform|execute|executed)\b/i.test(normalized);
    const startsAsSkillDeclaration = /^\s*(skill(?:ed)?|proficient|experience|familiar|knowledge(?:able)?|expertise)\b/i.test(normalized);

    if (hasActionContent && !startsAsSkillDeclaration) return false;
    return true;
  }

  function isLikelyStandaloneSkillBullet(bullet) {
    const normalized = normalizeBulletText(bullet);
    if (!normalized) return false;
    if (normalized.split(/\s+/).length > 6) return false;
    if (/^[.\-\s]*skill(?:ed)?\s+in\b/i.test(normalized)) return true;
    if (/\b(managed|manage|coordinated|coordinate|created|create|established|establish|interview|onboard|approve|approved|performed|perform|execute|executed)\b/i.test(normalized)) {
      return false;
    }
    return isLikelySkill(normalized);
  }

  function relocateSkillStatementsFromExperience(structured) {
    const model = structured || {};
    const relocatedSkills = [];

    const nextExperiences = (model.experiences || []).map((experience) => {
      const nextBullets = [];

      (experience.bullets || []).forEach((bullet) => {
        const normalizedBullet = normalizeBulletText(bullet);
        if (isLikelyStandaloneSkillBullet(normalizedBullet)) {
          relocatedSkills.push(...filterAndCleanSkills([normalizedBullet]));
          return;
        }

        const sentences = String(bullet || '')
          .split(/(?<=[.!?])\s+/)
          .map((item) => normalizeBulletText(item))
          .filter(Boolean);

        const keptSentences = [];

        sentences.forEach((sentence) => {
          if (shouldRelocateSkillSentence(sentence)) {
            relocatedSkills.push(...filterAndCleanSkills([sentence]));
            return;
          }
          keptSentences.push(sentence);
        });

        const rebuiltBullet = normalizeBulletText(keptSentences.join(' '));
        if (rebuiltBullet) nextBullets.push(rebuiltBullet);
      });

      return {
        ...experience,
        bullets: nextBullets
      };
    });

    const mergedSkills = filterAndCleanSkills([...(model.skills || []), ...relocatedSkills]);

    return {
      ...model,
      experiences: nextExperiences,
      skills: mergedSkills
    };
  }

  function getJobSkillSignals() {
    return [
      { pattern: /autocad/i, label: 'AutoCAD', priority: 1 },
      { pattern: /magic\s*plan/i, label: 'MagicPlan', priority: 1 },
      { pattern: /pmp|project management professional/i, label: 'PMP Certification', priority: 1 },
      { pattern: /six sigma/i, label: 'Six Sigma', priority: 1 },
      { pattern: /project management/i, label: 'Project Management', priority: 2 },
      { pattern: /cross[- ]functional/i, label: 'Cross-Functional Team Leadership', priority: 2 },
      { pattern: /installation/i, label: 'Customer Installation Coordination', priority: 2 },
      { pattern: /implementation process|implementation/i, label: 'Project Implementation Management', priority: 2 },
      { pattern: /manage multiple projects simultaneously|multiple projects simultaneously/i, label: 'Multi-Project Management', priority: 2 },
      { pattern: /identify, escalate, and resolve issues|escalate,? and resolve issues|issue[s]?/i, label: 'Issue Escalation and Resolution', priority: 2 },
      { pattern: /customer satisfaction/i, label: 'Customer Satisfaction Management', priority: 2 },
      { pattern: /process productivity/i, label: 'Process Productivity Improvement', priority: 2 },
      { pattern: /sales and services teams/i, label: 'Sales and Service Team Coordination', priority: 3 },
      { pattern: /diagnostic imaging/i, label: 'Diagnostic Imaging Project Support', priority: 3 },
      { pattern: /clinical environment/i, label: 'Clinical Environment Support', priority: 3 },
      { pattern: /construction|building trades/i, label: 'Construction and Building Trades Coordination', priority: 3 },
      { pattern: /scheduled completion dates|deadlines/i, label: 'Schedule and Deadline Management', priority: 3 },
      { pattern: /customer expectations/i, label: 'Stakeholder Expectation Management', priority: 3 },
      { pattern: /travel regularly|overnight/i, label: 'Field-Based Project Support', priority: 3 },
      { pattern: /work independently|home office/i, label: 'Independent Project Execution', priority: 3 }
    ];
  }

  function extractSkillsFromJobDescription(jobDescription) {
    const text = String(jobDescription || '');
    if (!text.trim()) return [];

    const matches = getJobSkillSignals()
      .filter((item) => item.pattern.test(text))
      .sort((left, right) => left.priority - right.priority)
      .map((item) => item.label);

    return [...new Set(matches)];
  }

  function extractMatchedSkillsFromSource(jobDescription, sourceText) {
    const jobText = String(jobDescription || '');
    const resumeText = String(sourceText || '');
    if (!jobText.trim() || !resumeText.trim()) return [];

    return getJobSkillSignals()
      .filter((item) => item.pattern.test(jobText) && item.pattern.test(resumeText))
      .sort((left, right) => left.priority - right.priority)
      .map((item) => item.label);
  }

  function extractJobTitleFromDescription(jobDescription) {
    const text = String(jobDescription || '');
    const titleMatch = text.match(/Job Title:\s*([^\n]+)/i);
    return normalizeBulletText(titleMatch ? titleMatch[1] : '');
  }

  function isGenericProfile(profile) {
    const normalized = normalizeBulletText(profile).toLowerCase();
    if (!normalized) return true;

    if (normalized === 'results-driven professional with relevant experience and a strong record of delivering measurable outcomes.') {
      return true;
    }

    return /results-driven professional|relevant experience|measurable outcomes|strong record/i.test(normalized);
  }

  function buildProfileFromJobDescription(jobDescription) {
    const text = String(jobDescription || '');
    if (!text.trim()) return '';

    const roleTitle = extractJobTitleFromDescription(text) || 'Project Management Professional';
    const coreFocus = [
      /installation/i.test(text) ? 'customer-facing installation projects' : '',
      /implementation process|implementation/i.test(text) ? 'project implementation and delivery' : '',
      /diagnostic imaging/i.test(text) ? 'diagnostic imaging environments' : '',
      /clinical environment/i.test(text) ? 'clinical settings' : ''
    ].filter(Boolean);
    const executionStrengths = [
      /project management/i.test(text) ? 'project execution' : '',
      /cross[- ]functional/i.test(text) ? 'cross-functional team coordination' : '',
      /identify, escalate, and resolve issues|escalate,? and resolve issues|issue[s]?/i.test(text) ? 'issue escalation and resolution' : '',
      /customer satisfaction/i.test(text) ? 'customer satisfaction' : '',
      /scheduled completion dates|deadlines/i.test(text) ? 'schedule management' : '',
      /construction|building trades/i.test(text) ? 'construction and site coordination' : ''
    ].filter(Boolean);
    const toolsAndCredentials = [
      /autocad/i.test(text) ? 'AutoCAD' : '',
      /magic\s*plan/i.test(text) ? 'MagicPlan' : '',
      /pmp|project management professional/i.test(text) ? 'PMP Certification' : '',
      /six sigma/i.test(text) ? 'Six Sigma' : ''
    ].filter(Boolean);

    const sentences = [];

    if (coreFocus.length) {
      const focusText = coreFocus.slice(0, 2).join(' and ');
      sentences.push(`${roleTitle} with experience managing ${focusText} across customer, technical, and operational stakeholders.`);
    } else {
      sentences.push(`${roleTitle} with experience delivering customer-facing project execution in complex operational environments.`);
    }

    if (executionStrengths.length) {
      sentences.push(`Brings strength in ${executionStrengths.slice(0, 4).join(', ')}, helping keep milestones on track and customer expectations aligned.`);
    }

    if (toolsAndCredentials.length) {
      sentences.push(`Supported by ${toolsAndCredentials.join(', ')}, with the structure and technical fluency needed for high-visibility implementations.`);
    }

    return sentences.join(' ');
  }

  function alignSkillsToJobDescription(structured, jobDescription, sourceResumeText = '') {
    const existingSkills = filterAndCleanSkills((structured.skills || []).map((skill) => normalizeBulletText(skill)).filter(Boolean));
    const sourceSkills = filterAndCleanSkills(extractInlineSkillsFromResumeText(sourceResumeText));
    const combinedSkills = [...sourceSkills, ...existingSkills].map((skill) => normalizeBulletText(skill)).filter(Boolean);

    if (combinedSkills.length) {
      structured.skills = [...new Set(combinedSkills)].slice(0, 12);
      return structured;
    }

    // Resume Generator should only show evidence-based skills from the candidate's resume.
    structured.skills = [];
    return structured;
  }

  function alignProfileToJobDescription(structured, jobDescription) {
    const generatedProfile = buildProfileFromJobDescription(jobDescription);
    if (!generatedProfile) return structured;

    if (isGenericProfile(structured.profile)) {
      structured.profile = generatedProfile;
      return structured;
    }

    const normalizedProfile = normalizeBulletText(structured.profile);
    const combined = [normalizedProfile, generatedProfile]
      .map((item) => normalizeBulletText(item))
      .filter(Boolean);

    structured.profile = [...new Set(combined)].join(' ');
    return structured;
  }

  function alignResumeToJobDescription(structured, jobDescription, sourceResumeText = '') {
    alignSkillsToJobDescription(structured, jobDescription, sourceResumeText);
    alignProfileToJobDescription(structured, jobDescription);
    return structured;
  }

  function parseResume(rawText, fallbackFromBase, sourceResumeText = '') {
    const text = String(rawText || '').replace(/\r/g, '');
    const lines = text.split('\n').map((line) => line.trimRight());

    const structured = {
      fullName: cleanCandidateName(fallbackFromBase.fullName) || cleanCandidateName(accountName) || 'Professional Candidate',
      contactLines: [fallbackFromBase.phone, fallbackFromBase.email, fallbackFromBase.location, fallbackFromBase.linkedin].filter(Boolean),
      profile: '',
      experiences: [],
      education: [],
      skills: [],
      certifications: [],
      awards: []
    };

    const sectionIndex = {
      NAME: -1,
      CONTACT: -1,
      PROFILE: -1,
      EXPERIENCE: -1,
      EDUCATION: -1,
      CERTIFICATION: -1,
      CERTIFICATIONS: -1,
      SKILLS: -1,
      AWARDS: -1,
      IMPROVEMENTS: -1
    };

    const canonicalSectionKey = (rawLine) => {
      let key = normalizeBulletText(String(rawLine || '')).replace(/[:\-]/g, ' ').trim().toUpperCase();
      key = key.replace(/\s+/g, ' ');
      key = key.replace(/^(CORE|PROFESSIONAL|MY|PRIMARY|ADDITIONAL|KEY|TECHNICAL|RELEVANT|OTHER|HARD|SOFT|STRENGTHS?)\s+/, '');
      key = key.replace(/\s+(SECTIONS?|AREA|SUMMARY|LIST)$/g, '').trim();
      key = key.replace(/\s+((?:\d{1,2}\/|\d{4})\S*).*$/, '').trim();

      if (key === 'SUMMARY') return 'PROFILE';
      if (key === 'WORK' || key === 'HISTORY') return 'EXPERIENCE';
      if (/SKILLS?|COMPETENC(Y|IES)|CORE COMPETENC(Y|IES)|TECHNICAL SKILLS?/.test(key)) return 'SKILLS';
      if (/CERTIFICATIONS?|LICENSES?/.test(key)) return 'CERTIFICATIONS';

      return key;
    };

    lines.forEach((line, idx) => {
      const key = canonicalSectionKey(line);
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

    const fallbackName = cleanCandidateName(fallbackFromBase.fullName);
    const normalizedParsedName = cleanCandidateName(parsedName);
    if (normalizedParsedName) {
      structured.fullName = normalizedParsedName;
    } else if (fallbackName) {
      structured.fullName = fallbackName;
    }

    // Matches lines like: "Company  1/2021-11/2023", "Company  2015-2022", "Company  Jan 2020 – Present"
    const companyDateLineRx = /^(.+?)\s{2,}((?:\d{1,2}\/\d{2,4}|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})\s*(?:[-–to]+\s*(?:\d{1,2}\/\d{2,4}|\d{4}|present|current|now))?)$/i;

    const rawProfileLines = between(sectionIndex.PROFILE, nextSectionStart('PROFILE'));

    // Split at the first line that looks like a company+date header so profile text
    // doesn't absorb experience entries (common when there is no EXPERIENCE heading).
    const firstJobIdx = rawProfileLines.findIndex((l) => companyDateLineRx.test(l) && l.trim().length > 15 && !/^(professional summary|summary|profile|experience|education|skills)/i.test(l.trim()));
    if (firstJobIdx > 0) {
      structured.profile = rawProfileLines.slice(0, firstJobIdx).join(' ');
      const bodyExperienceLines = rawProfileLines.slice(firstJobIdx);
      structured.experiences = parseExperienceEntriesFromBody(bodyExperienceLines);
    } else if (firstJobIdx === 0) {
      structured.profile = '';
      structured.experiences = parseExperienceEntriesFromBody(rawProfileLines);
    } else {
      structured.profile = rawProfileLines.join(' ');
    }

    const experienceLines = between(sectionIndex.EXPERIENCE, nextSectionStart('EXPERIENCE'));
    const parsedExperiences = parseExperienceEntries(experienceLines);
    structured.experiences = mergeExperienceEntries(parsedExperiences, structured.experiences);

    const fallbackExperienceMatch = String(sourceResumeText || '').replace(/\r/g, '').match(/\bEXPERIENCE\b([\s\S]*?)(?:\n\s*(?:CORE\s+SKILLS|SKILLS|EDUCATION|CERTIFICATION|CERTIFICATIONS|AWARDS|PROJECTS)\b|$)/i);
    if (fallbackExperienceMatch && fallbackExperienceMatch[1]) {
      const fallbackExperienceLines = fallbackExperienceMatch[1].split('\n').map((line) => line.trim()).filter(Boolean);
      const fallbackExperiences = parseExperienceEntries(fallbackExperienceLines);
      structured.experiences = mergeExperienceEntries(structured.experiences, fallbackExperiences);
    }

    structured.education = between(sectionIndex.EDUCATION, nextSectionStart('EDUCATION'))
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);

    const certSectionStart = sectionIndex.CERTIFICATIONS >= 0 ? sectionIndex.CERTIFICATIONS : sectionIndex.CERTIFICATION;
    const certificationLines = certSectionStart >= 0
      ? between(certSectionStart, nextSectionStart(certSectionStart === sectionIndex.CERTIFICATIONS ? 'CERTIFICATIONS' : 'CERTIFICATION'))
      : [];

    // Split certification section into actual degrees (for education) and certifications
    const degreeLines = [];
    const actualCertifications = [];
    
    certificationLines.forEach((line) => {
      const normalized = normalizeBulletText(line);
      if (normalized) {
        if (isDegreeLine(line)) {
          degreeLines.push(normalized);
        } else {
          actualCertifications.push(normalized);
        }
      }
    });

    // Add degree lines to education
    structured.education = [...structured.education, ...degreeLines];

    structured.certifications = actualCertifications;

    const rawSkillsLines = between(sectionIndex.SKILLS, nextSectionStart('SKILLS'));
    const skillsText = rawSkillsLines.join(', ');
    const parsedSkills = skillsText
      .split(/[,|]/)
      .map((s) => normalizeBulletText(s))
      .filter(Boolean);
    
    structured.skills = filterAndCleanSkills(parsedSkills);

    const awardsLines = between(sectionIndex.AWARDS, nextSectionStart('AWARDS'))
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);

    structured.awards = [...new Set([...(structured.certifications || []), ...awardsLines])];

    if (!cleanCandidateName(structured.fullName)) {
      structured.fullName = cleanCandidateName(fallbackFromBase.fullName) || cleanCandidateName(accountName) || 'Professional Candidate';
    }

    if (!structured.profile) {
      structured.profile = 'Results-driven professional with relevant experience and a strong record of delivering measurable outcomes.';
    }

    if (!structured.experiences.length) {
      structured.experiences = [{
        title: 'Professional Experience',
        company: '',
        bullets: [
          'Tailored core achievements to align with the target role requirements.',
          'Highlighted impact-driven accomplishments and relevant skills.'
        ]
      }];
    }

    if (!structured.education.length) structured.education = ['Education details available upon request'];
    if (!structured.skills.length) structured.skills = [];

    return structured;
  }

  function mergeUniqueLines(primary, secondary) {
    const seen = new Set();
    const merged = [];
    const blocked = new Set(['education details available upon request', 'n/a']);

    [...(primary || []), ...(secondary || [])].forEach((line) => {
      const clean = normalizeBulletText(line);
      if (!clean) return;
      const key = clean.toLowerCase();
      if (blocked.has(key) || seen.has(key)) return;
      seen.add(key);
      merged.push(clean);
    });

    return merged;
  }

  function extractInlineSkillsFromResumeText(sourceText) {
    const text = String(sourceText || '').replace(/\r/g, ' ');
    if (!text.trim()) return [];

    const sectionMatch = text.match(/\bSKILLS?\b\s*[:\-]?\s*([\s\S]*?)(?=\b(?:EXPERIENCE|EDUCATION|CERTIFICATION|CERTIFICATIONS|AWARDS|PROJECTS|PROFILE|SUMMARY)\b|$)/i);
    const sectionText = sectionMatch ? sectionMatch[1] : '';
    if (!sectionText.trim()) return [];

    return sectionText
      .split(/[,|•\n]/)
      .map((item) => normalizeBulletText(item))
      .filter(Boolean)
      .filter((item) => item.length > 1)
      .slice(0, 12);
  }

  function isEducationInstitutionLine(line) {
    const value = normalizeBulletText(line);
    if (!value) return false;
    const institutionSignals = /(university|college|institute|school|academy|polytechnic|abet|campus)/i;
    const degreeSignals = /(bachelor|master|doctor|associate|ph\.?d|mba|degree|certificate|diploma|expected|\d{2}\/\d{4})/i;
    return institutionSignals.test(value) && !degreeSignals.test(value);
  }

  function isEducationProgramLine(line) {
    const value = normalizeBulletText(line);
    if (!value) return false;
    return /(bachelor|master|doctor|associate|ph\.?d|mba|degree|certificate|diploma|expected|\d{2}\/\d{4}|\d{4}|present)/i.test(value);
  }

  function formatEducationEntries(lines) {
    const entries = (lines || []).map((line) => normalizeBulletText(line)).filter(Boolean);
    const formatted = [];

    for (let i = 0; i < entries.length; i += 1) {
      const current = entries[i];

      if (!isEducationInstitutionLine(current)) {
        formatted.push(current);
        continue;
      }

      let j = i + 1;
      const programs = [];
      while (j < entries.length && !isEducationInstitutionLine(entries[j])) {
        if (isEducationProgramLine(entries[j])) programs.push(entries[j]);
        j += 1;
      }

      if (!programs.length) {
        formatted.push(current);
        continue;
      }

      programs.forEach((program) => {
        const combined = program.toLowerCase().includes(current.toLowerCase())
          ? program
          : `${current} - ${program}`;
        formatted.push(combined);
      });

      i = j - 1;
    }

    return mergeUniqueLines(formatted, []).map((line) => normalizeStateAbbreviations(line));
  }

  function sanitizeProfileText(profile) {
    const text = String(profile || '').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
    return text.replace(/\s+(EXPERIENCE|EDUCATION|SKILLS|AWARDS|CERTIFICATION|CERTIFICATIONS)\s*$/i, '').trim();
  }

  function buildResumePdfFilename(model) {
    const namePart = String(model?.displayName || model?.fullName || 'resume')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'resume';
    const layoutPart = String(model?.theme?.id || 'template')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'template';
    return `resume-${namePart}-${layoutPart}.pdf`;
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

  function renderLineListHtml(items, fontSize, color, marginBottom) {
    return (items || []).map((item) => normalizeBulletText(item)).filter(Boolean).map((item) => `
      <div style="font-size:${fontSize};line-height:1.6;color:${color};margin-bottom:${marginBottom};font-weight:400;">
        <span style="font-weight:400;">${escapeHtml(item)}</span>
      </div>
    `).join('');
  }

  function renderSectionHeading(label, theme, fontSize, extraStyles) {
    return `<div style="font-size:${fontSize};font-weight:800;letter-spacing:0.04em;color:${theme.headingText};margin-bottom:10px;${extraStyles || ''}">${label}</div>`;
  }

  function renderTemplateForest(model, theme) {
    const displayName = model.displayName || model.fullName;
    const name = splitName(displayName);
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup(model, theme, false);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:${theme.primary};padding:24px 28px;color:${theme.headerText};display:flex;gap:18px;align-items:center;">
          ${photoMarkup ? `<div style="flex:0 0 auto;">${photoMarkup}</div>` : ''}
          <div style="flex:1;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.03em;">${escapeHtml((name.first + ' ' + name.rest).trim())}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;opacity:0.92;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="padding:24px 20px;background:${theme.sidebarBg};border-right:1px solid #e5e7eb;">
            ${renderSectionHeading('CONTACT', theme, '15px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '12pt', '#1f2937', '6px')}
            ${renderSectionHeading('CERTIFICATIONS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px 28px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#374151', '8px')}
            <hr style="border:none;border-top:1px solid #d1d5db;margin:18px 0;" />
            ${renderSectionHeading('EXPERIENCE', theme, '16px')}
            ${model.experiences.map((exp) => {
              const processed = processExperienceForRender(exp);
              return `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(processed.title || processed.heading || '')}</div>
                ${processed.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(processed.company)}</div>` : ''}
                ${renderBulletListHtml(processed.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `;
            }).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin-top:14px;')}
            ${renderLineListHtml(model.education || [], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateGold(model, theme) {
    const displayName = model.displayName || model.fullName;
    const name = splitName(displayName);
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
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '12pt', '#ffffff', '6px')}
            ${renderSectionHeading('EDUCATION', { ...theme, headingText: '#ffffff' }, '15px', 'margin-top:22px;')}
            ${renderLineListHtml(model.education || [], '12pt', '#ffffff', '6px')}
          </aside>
          <section style="padding:26px 28px;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;color:#111827;">${escapeHtml(name.first)}<span style="font-weight:500;">${escapeHtml(name.rest ? ' ' + name.rest : '')}</span></div>
            <div style="font-size:18px;color:#4b5563;font-weight:600;margin:8px 0 18px 0;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#4b5563', '8px')}

            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin-top:18px;')}
            ${model.experiences.map((exp) => {
              const processed = processExperienceForRender(exp);
              return `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(processed.title || processed.heading || '')}</div>
                ${processed.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(processed.company)}</div>` : ''}
                ${renderBulletListHtml(processed.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `;
            }).join('')}

            ${renderSectionHeading('CERTIFICATIONS', theme, '16px', 'margin-top:14px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateSlate(model, theme) {
    const displayName = model.displayName || model.fullName;
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup(model, theme, false);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:linear-gradient(110deg, ${theme.primary}, ${theme.accent});padding:24px 28px;color:${theme.headerText};display:flex;align-items:center;gap:18px;">
          ${photoMarkup || ''}
          <div>
            <div style="font-size:36px;font-weight:800;line-height:1.05;letter-spacing:0.03em;">${escapeHtml(displayName)}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:24px 20px;border-right:1px solid #d1d5db;">
            ${renderSectionHeading('CONTACT', theme, '15px', 'margin-bottom:8px;')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin:22px 0 8px 0;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 9), '12pt', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px', 'margin-bottom:8px;')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#374151', '8px')}
            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin:18px 0 8px 0;')}
            ${model.experiences.map((exp) => {
              const processed = processExperienceForRender(exp);
              return `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(processed.title || processed.heading || '')}</div>
                ${processed.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(processed.company)}</div>` : ''}
                ${renderBulletListHtml(processed.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `;
            }).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderLineListHtml(model.education || [], '12pt', '#374151', '6px')}
            ${renderSectionHeading('AWARDS', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateBlank(model) {
    const escapeHtml = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const renderBulletList = (items) => (items || []).map((item) => `<div style="margin-bottom:6px;font-size:12pt;">• ${escapeHtml(item)}</div>`).join('');
    const renderLineList = (items) => (items || []).map((item) => `<div style="margin-bottom:6px;font-size:12pt;">${escapeHtml(item)}</div>`).join('');
    
    return `
      <div style="font-family:Arial, sans-serif; max-width:850px; margin:0 auto; padding:40px; background:#fff; color:#000; line-height:1.6;">
        <div style="text-align:center; margin-bottom:24px; border-bottom:2px solid #000; padding-bottom:16px;">
          <div style="font-size:28px; font-weight:bold; margin-bottom:4px;">${escapeHtml(model.displayName || 'Professional')}</div>
          <div style="font-size:14px; color:#333;">${(model.contactLines || []).join(' • ')}</div>
          ${model.targetRole ? `<div style="font-size:16px; font-weight:600; margin-top:8px;">${escapeHtml(model.targetRole)}</div>` : ''}
        </div>
        
        ${model.profile ? `<div style="margin-bottom:20px;"><div style="font-weight:bold; margin-bottom:8px;">PROFILE</div><div style="font-size:14px;">${escapeHtml(model.profile)}</div></div>` : ''}
        
        ${model.experiences && model.experiences.length ? `<div style="margin-bottom:20px;">
          <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">EXPERIENCE</div>
          ${model.experiences.map((exp) => {
            const processed = processExperienceForRender(exp);
            return `
            <div style="margin-bottom:12px;">
              <div style="font-weight:600;">${escapeHtml(processed.title || '')}</div>
              ${processed.company ? `<div style="font-size:13px; color:#555;">${escapeHtml(processed.company)}</div>` : ''}
              ${renderBulletList((processed.bullets || []).slice(0, 3))}
            </div>
          `;
          }).join('')}
        </div>` : ''}
        
        ${model.education && model.education.length ? `<div style="margin-bottom:20px;">
          <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">EDUCATION</div>
          ${renderLineList((model.education || []).slice(0, 5))}
        </div>` : ''}
        
        ${model.skills && model.skills.length ? `<div style="margin-bottom:20px;">
          <div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">SKILLS</div>
          <div style="font-size:14px;">${escapeHtml((model.skills || []).join(' • '))}</div>
        </div>` : ''}
      </div>
    `;
  }

  function renderResumeTemplate(model) {
    if (model.theme?.id === BLANK_LAYOUT_ID) return renderTemplateBlank(model);
    const theme = model.theme || THEMES[0];
    if (theme.layoutType === 'gold') return renderTemplateGold(model, theme);
    if (theme.layoutType === 'slate') return renderTemplateSlate(model, theme);
    return renderTemplateForest(model, theme);
  }

  function renderError(message) {
    output.innerHTML = `<div style="color:#dc2626;font-size:1.05rem;">${escapeHtml(message)}</div>`;
  }

  function statusBanner(message, ok, options = {}) {
    const banner = document.createElement('div');
    banner.style.marginBottom = '10px';
    banner.style.padding = '10px 12px';
    banner.style.borderRadius = '8px';
    banner.style.fontSize = '0.95rem';
    banner.style.background = ok ? '#ecfdf5' : '#fef2f2';
    banner.style.color = ok ? '#166534' : '#991b1b';
    banner.style.border = `1px solid ${ok ? '#86efac' : '#fecaca'}`;
    banner.textContent = message;
    output.insertBefore(banner, output.firstChild);

    const autoDismissMs = Number(options.autoDismissMs || 0);
    if (autoDismissMs > 0) {
      setTimeout(() => {
        if (banner.parentNode) banner.remove();
      }, autoDismissMs);
    }
  }

  function toUserFriendlyNetworkMessage(message, fallback) {
    const raw = String(message || '').trim();
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
      return 'Cannot reach billing server right now. Please retry in a moment.';
    }
    if (/no token|unauthorized|forbidden|auth/i.test(raw)) {
      return 'Please log in to load your credit balance.';
    }
    return raw || fallback;
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

  function clearGeneratorFields() {
    const jobTitleInput = document.getElementById('resumeJobTitleGen');
    const companyInput = document.getElementById('resumeCompanyGen');
    const baseResumeInput = document.getElementById('resumeBaseGen');
    const jobDescriptionInput = document.getElementById('resumeJobDescriptionGen');

    if (jobTitleInput) jobTitleInput.value = '';
    if (companyInput) companyInput.value = '';
    if (baseResumeInput) baseResumeInput.value = '';
    if (jobDescriptionInput) jobDescriptionInput.value = '';
    if (resumeUploadInput) resumeUploadInput.value = '';

    if (resumeUploadMessage) {
      resumeUploadMessage.textContent = '';
      resumeUploadMessage.style.color = '#64748b';
    }

    resetPhotoSelection();

    lastRawResume = '';
    lastStructuredResume = null;
    output.innerHTML = '';
    clearDraftState();
    renderLinkedinAdoptionInsights();
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
        const res = await fetch(getApiEndpoint('/api/resume/upload'), { method: 'POST', headers, body: formData });
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

      saveDraftState();
    } catch (error) {
      if (messageEl) {
        messageEl.textContent = error.message || 'Could not load the uploaded resume.';
        messageEl.style.color = '#dc2626';
      }
    }
  }

  function buildResumeModel(structured, targetRole) {
    const displayName = toTitleCaseName(structured?.fullName) || 'Professional Candidate';
    const normalizedTargetRole = capitalizeJobTitle(targetRole || '');
    return {
      ...structured,
      fullName: displayName,
      displayName,
      targetRole: normalizedTargetRole,
      photoDataUrl: lastPhotoDataUrl,
      photoPosition: { ...lastPhotoPosition },
      theme: resolveSelectedTheme()
    };
  }

  function buildResumePdfDoc(model) {
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
    doc.text((model.displayName || model.fullName || '').slice(0, 40), rightX, 21);

    doc.setFontSize(10);
    doc.text((model.targetRole || 'Professional Candidate').slice(0, 60), rightX, 28);

    let leftY = 42;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTACT', leftX, leftY);
    leftY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
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
    doc.setFontSize(12);
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
    doc.setFontSize(12);
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
      const processed = processExperienceForRender(exp);
      if (rightY > 272) {
        doc.addPage();
        rightY = 16;
      }
      const expTitle = processed.title || processed.heading || '';
      if (expTitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(31, 41, 55);
        wrapped = doc.splitTextToSize(expTitle, rightW);
        doc.text(wrapped, rightX, rightY);
        rightY += wrapped.length * 4.2;
      }
      if (processed.company) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        wrapped = doc.splitTextToSize(processed.company, rightW);
        doc.text(wrapped, rightX, rightY);
        rightY += wrapped.length * 4.2;
        doc.setTextColor(31, 41, 55);
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      (processed.bullets || []).forEach((bullet) => {
        const cleanBullet = normalizeBulletText(bullet);
        if (!cleanBullet) return;
        const bulletWrapped = doc.splitTextToSize(`• ${cleanBullet}`, rightW);
        doc.text(bulletWrapped, rightX, rightY);
        rightY += bulletWrapped.length * 4.2;
      });
      rightY += 2;
    });

    drawTitle('EDUCATION');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    (model.education || []).forEach((line) => {
      const cleanLine = normalizeBulletText(line);
      if (!cleanLine) return;
      wrapped = doc.splitTextToSize(cleanLine, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    rightY += 2;
    drawTitle('CERTIFICATIONS');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const certifications = model.awards || model.certifications || [];
    (certifications.length ? certifications : ['N/A']).forEach((line) => {
      const cleanLine = normalizeBulletText(line);
      if (!cleanLine) return;
      wrapped = doc.splitTextToSize(`• ${cleanLine}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    return doc;
  }

  function exportResumePdf(model) {
    const doc = buildResumePdfDoc(model);
    doc.save(buildResumePdfFilename(model));
  }

  function createResumePdfBlob(model) {
    return buildResumePdfDoc(model).output('blob');
  }

  async function buildTemplatePdfDoc(model) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');
    const { jsPDF } = window.jspdf;

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '860px';
    host.style.padding = '0';
    host.style.margin = '0';
    host.style.background = '#ffffff';
    host.innerHTML = renderResumeTemplate(model);
    document.body.appendChild(host);

    try {
      if (window.html2canvas && typeof window.html2canvas === 'function') {
        const canvas = await window.html2canvas(host, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        });

        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const usableWidth = pageWidth - (margin * 2);
        const usableHeight = pageHeight - (margin * 2);

        const pixelPerMm = canvas.width / usableWidth;
        const pagePixelHeight = Math.floor(usableHeight * pixelPerMm);
        let offsetY = 0;
        let isFirstPage = true;

        while (offsetY < canvas.height) {
          const sliceHeight = Math.min(pagePixelHeight, canvas.height - offsetY);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext('2d');
          if (!ctx) break;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

          const imgData = pageCanvas.toDataURL('image/png');
          const renderedHeight = sliceHeight / pixelPerMm;
          if (!isFirstPage) doc.addPage();
          doc.addImage(imgData, 'PNG', margin, margin, usableWidth, renderedHeight, undefined, 'FAST');

          isFirstPage = false;
          offsetY += sliceHeight;
        }

        return doc;
      }

      return buildResumePdfDoc(model);
    } finally {
      document.body.removeChild(host);
    }
  }

  async function exportResumePdfTemplate(model) {
    const doc = await buildTemplatePdfDoc(model);
    doc.save(buildResumePdfFilename(model));
  }

  async function createResumePdfBlobTemplate(model) {
    const doc = await buildTemplatePdfDoc(model);
    return doc.output('blob');
  }

  function createResumeWordBlob(model) {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:${model.theme.font};margin:0;color:#111827;">
  ${renderResumeTemplate(model)}
</body>
</html>`;

    return new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  }

  function exportResumeWord(model) {
    const blob = createResumeWordBlob(model);
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

    if (!jobTitle || !fullJobDescription) {
      renderError('Please add the job title and the full job description.');
      return;
    }

    output.innerHTML = '<div style="color:#2563eb;">Generating resume...</div>';

    try {
      const status = await loadResumeCreditStatus();
      if (status && !status.unlimited && !status.canGenerate) {
        renderError('No resume credits remaining. Buy a bundle to continue.');
        return;
      }

      if (templateStateReadyPromise) await templateStateReadyPromise;
      await loadLatestLearningRoadmap();

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

      const res = await fetch(getApiEndpoint('/api/resume/generate'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume: baseResume })
      });
      const data = await res.json();

      if (!res.ok || !data.result) {
        if (res.status === 402 && data.code === 'DOC_CREDIT_REQUIRED') {
          renderResumeCreditStatus(data.status || resumeCreditStatus);
          renderError(data.error || 'No resume credits remaining. Buy a bundle to continue.');
          return;
        }
        renderError((data && data.error) || 'Failed to generate resume.');
        return;
      }

      const raw = String(data.result || '').trim();
      lastRawResume = raw;
      const alignmentContext = withLearningContext(jobDescription);
      const parsed = parseResume(raw, extractContactInfo(baseResume), baseResume);
      const structured = baseResume
        ? parsed
        : alignResumeToJobDescription(parsed, alignmentContext, baseResume);

      if (baseResume) {
        const parsedBaseline = parseResume(baseResume, extractContactInfo(baseResume), baseResume);
        const inlineBaselineSkills = extractInlineSkillsFromResumeText(baseResume);
        const baselineSkills = inlineBaselineSkills.length
          ? inlineBaselineSkills
          : parsedBaseline.skills;
        structured.experiences = mergeExperienceEntries(parsedBaseline.experiences, structured.experiences);
        structured.profile = sanitizeProfileText(parsedBaseline.profile || structured.profile);
        if (baselineSkills && baselineSkills.length) {
          structured.skills = filterAndCleanSkills(baselineSkills);
        } else {
          // No explicit SKILLS section — mine skills from experience bullets in the original resume
          const bulletSkillCandidates = (parsedBaseline.experiences || [])
            .flatMap((exp) => (exp.bullets || []))
            .flatMap((bullet) => bullet.split(/[,;•]/))
            .map((s) => s.trim())
            .filter(Boolean);
          const minedSkills = filterAndCleanSkills(bulletSkillCandidates);
          // Also filter the AI-generated skills as a fallback
          const aiSkills = filterAndCleanSkills(structured.skills || []);
          structured.skills = minedSkills.length ? minedSkills : aiSkills;
        }
        structured.education = mergeUniqueLines(structured.education, parsedBaseline.education);
        structured.awards = mergeUniqueLines(structured.awards, parsedBaseline.awards);
      }

      structured.education = formatEducationEntries(structured.education);
      structured.profile = sanitizeProfileText(structured.profile);
      const normalizedStructured = relocateSkillStatementsFromExperience(structured);

      lastStructuredResume = buildResumeModel(normalizedStructured, jobTitle);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      renderLinkedinAdoptionInsights();
      await loadResumeCreditStatus();
      statusBanner('Resume generated. You can switch layouts, adjust the photo, or download it as Word or PDF.', true);

      if (window.RoleRocketQuickstart) {
        window.RoleRocketQuickstart.completeStep('tailor', 'resume_generated');
      }
    } catch (err) {
      renderError('Error generating resume.');
    }
  });

  buySingleBtn?.addEventListener('click', function () {
    startCreditCheckout('single');
  });
  buyFiveBtn?.addEventListener('click', function () {
    startCreditCheckout('five');
  });
  buyTenBtn?.addEventListener('click', function () {
    startCreditCheckout('ten');
  });

  function previewResume() {
    if (!canPreviewResume(userPlan)) {
      renderError('Resume preview is available on Pro, Premium, Elite, and Lifetime plans.');
      return;
    }

    const resumeText = document.getElementById('resumeBaseGen').value.trim();
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescriptionGen').value.trim();
    const jobDescription = [
      jobTitle ? `Job Title: ${jobTitle}` : '',
      company ? `Company: ${company}` : '',
      fullJobDescription ? '' : '',
      fullJobDescription ? 'Full Job Description:' : '',
      fullJobDescription
    ].filter(Boolean).join('\n');
    // Parse the resume to extract all sections. Preview should preserve source content.
    const parsed = parseResume(resumeText, {
      fullName: '',
      phone: '',
      email: '',
      location: '',
      linkedin: ''
    }, resumeText);

    parsed.education = formatEducationEntries(parsed.education);
    parsed.profile = sanitizeProfileText(parsed.profile);
    
    const model = buildResumeModel(
      {
        fullName: parsed.fullName,
        contactLines: parsed.contactLines,
        profile: parsed.profile,
        experiences: parsed.experiences,
        education: parsed.education,
        awards: parsed.awards,
        skills: parsed.skills
      },
      document.getElementById('resumeJobTitleGen').value.trim() || 'Target Position'
    );

    if (previewContent) {
      previewContent.innerHTML = renderResumeTemplate(model);
    }
    if (previewModal) {
      previewModal.style.display = 'flex';
      previewModal.style.flexDirection = 'column';
    }
  }

  previewBtn?.addEventListener('click', function () {
    previewResume();
  });

  closePreviewModalBtn?.addEventListener('click', function () {
    if (previewModal) previewModal.style.display = 'none';
  });

  closePreviewBtn?.addEventListener('click', function () {
    if (previewModal) previewModal.style.display = 'none';
  });

  previewModal?.addEventListener('click', function (e) {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
    }
  });

  savePdfBtn?.addEventListener('click', async function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to save. Please generate first.');
        return;
      }
      await exportResumePdfTemplate(lastStructuredResume);
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

  sendEmailBtn?.addEventListener('click', async function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to send. Please generate first.');
        return;
      }

      sendEmailBtn.disabled = true;
      sendEmailBtn.textContent = 'Sending...';
      const htmlContent = `<!DOCTYPE html><html><body style="font-family:${lastStructuredResume.theme.font};margin:0;color:#111827;">${renderResumeTemplate(lastStructuredResume)}</body></html>`;
      const pdfBlob = await createResumePdfBlobTemplate(lastStructuredResume);
      const wordBlob = createResumeWordBlob(lastStructuredResume);
      const result = await window.sendDocumentToAccountEmail({
        feature: 'Resume',
        filename: 'tailored-resume',
        htmlContent,
        textContent: lastRawResume,
        attachments: [
          { filename: 'tailored-resume.pdf', blob: pdfBlob, contentType: 'application/pdf' },
          { filename: 'tailored-resume.doc', blob: wordBlob, contentType: 'application/msword' }
        ]
      });
      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send to Email';

      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      if (result.ok) {
        statusBanner('Sent! Check your inbox — if you don\'t see it within a minute, check your spam or junk folder.', true);
      } else {
        renderError(result.error || 'Could not send resume email.');
      }
    } catch (err) {
      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send to Email';
      renderError('Could not send resume email.');
    }
  });

  clearFieldsBtn?.addEventListener('click', function () {
    clearGeneratorFields();
    statusBanner('Fields cleared. Add new details to generate another resume.', true);
  });

  renderPhotoPreview();
  restoreDraftState();
  attachDraftPersistence();
  renderLinkedinAdoptionInsights();

  loadResumeCreditStatus().catch((error) => {
    if (billingStatus) {
      billingStatus.textContent = toUserFriendlyNetworkMessage(
        error && error.message,
        'Could not load billing status.'
      );
    }
  });

  const checkoutParams = new URLSearchParams(window.location.search);
  const checkoutResult = checkoutParams.get('docCredits');
  const checkoutSessionId = String(checkoutParams.get('session_id') || '').trim();

  if (checkoutResult || checkoutSessionId) {
    checkoutParams.delete('docCredits');
    checkoutParams.delete('session_id');
    const cleanedQuery = checkoutParams.toString();
    const cleanedUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanedUrl);

    // Keep the first Back press inside the app after returning from Stripe.
    if (checkoutResult === 'success' || checkoutResult === 'cancel') {
      const guardKey = `rr:doc-checkout:guarded:${checkoutSessionId || 'no-session'}`;
      if (sessionStorage.getItem(guardKey) !== '1') {
        window.history.pushState({ rrCheckoutReturnGuard: true }, '', cleanedUrl);
        sessionStorage.setItem(guardKey, '1');
      }
    }
  }

  if (checkoutResult === 'success') {
    if (checkoutSessionId) {
      sessionStorage.setItem(`rr:doc-checkout:seen:${checkoutSessionId}`, '1');
      confirmDocumentCheckoutSession(checkoutSessionId);
    }

    statusBanner('Payment received! Loading your credits...', true, { autoDismissMs: 5000 });

    // Poll until credits appear (webhook may be slightly delayed)
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const status = await loadResumeCreditStatus();
        if (status && (status.unlimited || status.canGenerate)) {
          clearInterval(pollInterval);
          statusBanner('Credits added successfully. You can generate now.', true, { autoDismissMs: 5000 });
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          statusBanner('Credits may take a moment to appear. Refresh the page if the button is still locked.', false);
        }
      } catch (_) {
        if (attempts >= maxAttempts) clearInterval(pollInterval);
      }
    }, 2000);
  } else if (checkoutResult === 'cancel') {
    statusBanner('Checkout canceled. You can continue with your free generation or purchase anytime.', false, { autoDismissMs: 5000 });
  }

  templateStateReadyPromise?.then(() => {
    if (learningRoadmapAppliedFromSession) {
      statusBanner('Learning roadmap applied. Generate or preview your resume to use this context.', true);
    }
  });
});
