// Ensure API utilities are available
if (typeof apiUrl !== 'function') {
  throw new Error('apiUrl is not defined. Make sure api-base.js is loaded before dashboard.js');
}
const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

// ─── Session Timeout Auto-Logout ─────────────────────────────
const SESSION_TIMEOUT_MINUTES = 30; // Set timeout duration here
// ─── RoleRocket Dashboard (Personalized) ─────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Resume
  const resumeEl = document.getElementById('dashboardResumeContent');
  if (resumeEl) {
    try {
      const res = await fetch('/api/resume', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.resumes && data.resumes.length > 0) {
        resumeEl.textContent = data.resumes[0].content;
      } else {
        resumeEl.textContent = 'No resume saved yet.';
      }
    } catch (err) {
      resumeEl.textContent = 'Could not load resume.';
    }
  }

  // Jobs Applied
  const jobsListEl = document.getElementById('dashboardJobsList');
  if (jobsListEl) {
    try {
      const res = await fetch('/api/jobs/applied', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        jobsListEl.innerHTML = data.jobs.map(job => `<li><strong>${escapeHtml(job.title)}</strong> at ${escapeHtml(job.company)}<br><span style='color:#6b7280;font-size:0.95em;'>${escapeHtml(job.status || 'Applied')}</span></li>`).join('');
      } else {
        jobsListEl.innerHTML = '<li>No jobs applied yet.</li>';
      }
    } catch (err) {
      jobsListEl.innerHTML = '<li>Could not load jobs.</li>';
    }
  }

  // Personal Tips
  const tipsEl = document.getElementById('dashboardTips');
  if (tipsEl) {
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const plan = (data.user && data.user.plan) || 'free';
      let tips = '';
      if (plan === 'pro') {
        tips = '<ul><li>Use Resume Generator for tailored resumes.</li><li>Try Cover Letter AI for each application.</li></ul>';
      } else if (plan === 'premium') {
        tips = '<ul><li>Optimize your resume with ATS Optimizer.</li><li>Use Interview Prep AI for upcoming interviews.</li></ul>';
      } else if (plan === 'elite') {
        tips = '<ul><li>Leverage Career Coach AI for strategy.</li><li>Review premium insights for your applications.</li></ul>';
      } else if (plan === 'lifetime') {
        tips = '<ul><li>Enjoy all features with permanent access.</li><li>Stay updated for new releases.</li></ul>';
      } else {
        tips = '<ul><li>Upgrade your plan to unlock more personalized tips!</li></ul>';
      }
      tipsEl.innerHTML = tips;
    } catch (err) {
      tipsEl.textContent = 'Could not load tips.';
    }
  }
});
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;
let sessionTimeoutTimer = null;

function resetSessionTimeout() {
  if (sessionTimeoutTimer) clearTimeout(sessionTimeoutTimer);
  sessionTimeoutTimer = setTimeout(() => {
    if (typeof clearStoredToken === 'function') {
      clearStoredToken();
    } else {
      localStorage.removeItem('token');
    }
    // Optionally, add a message to show on login page
    sessionStorage.setItem('session_expired', '1');
    window.location.href = 'login.html';
  }, SESSION_TIMEOUT_MS);
}

// Reset timer on user activity
['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, resetSessionTimeout, { passive: true });
});
resetSessionTimeout();

const jobsListEl = document.getElementById('jobsList');
const topJobsEl = document.getElementById('topJobs');
const importedJobBoxEl = document.getElementById('importedJobBox');

const savedJobsEl = document.getElementById('savedJobs');
const readyJobsEl = document.getElementById('readyJobs');
const appliedJobsEl = document.getElementById('appliedJobs');
const interviewJobsEl = document.getElementById('interviewJobs');
const offerJobsEl = document.getElementById('offerJobs');
const rejectedJobsEl = document.getElementById('rejectedJobs');

const planBadgeEl = document.getElementById('planBadge');
const proBtn = document.getElementById('proBtn');
const premiumBtn = document.getElementById('premiumBtn');
const eliteBtn = document.getElementById('eliteBtn');
const lifetimeBtn = document.getElementById('lifetimeBtn');
const planGuideEl = document.getElementById('planGuide');
const planGuideTierEl = document.getElementById('planGuideTier');
const planGuideTitleEl = document.getElementById('planGuideTitle');
const planGuideSubtitleEl = document.getElementById('planGuideSubtitle');
const planGuideSignalsEl = document.getElementById('planGuideSignals');
const planGuideAudienceEl = document.getElementById('planGuideAudience');
const planGuideOutcomeEl = document.getElementById('planGuideOutcome');
const planGuideNarrativeEl = document.getElementById('planGuideNarrative');
const planGuideBulletsEl = document.getElementById('planGuideBullets');
const planGuideStepsEl = document.getElementById('planGuideSteps');
const planGuideJumpBtn = document.getElementById('planGuideJumpBtn');

const careerCoachInsightEl = document.getElementById('careerCoachInsight');
const careerMatchSignalEl = document.getElementById('careerMatchSignal');
const careerUrgencyNudgeEl = document.getElementById('careerUrgencyNudge');

let currentUserPlan = 'free';
let lastFoundJobs = [];
let abVariant = 'A';
const localJobSearchCache = new Map();

const API_TIMEOUT_MS = 12000;
const API_DEFAULT_RETRIES = 1;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const offlineBanner = document.getElementById('offlineBanner');
const checkoutBanner = document.getElementById('checkoutBanner');
const starterModeBtn = document.getElementById('starterModeBtn');
const powerModeBtn = document.getElementById('powerModeBtn');
const modeSummary = document.getElementById('modeSummary');
const advancedInsightsBtn = document.getElementById('advancedInsightsBtn');
const advancedSectionEls = Array.from(document.querySelectorAll('.advanced-section'));
const todayPrimaryTitleEl = document.getElementById('todayPrimaryTitle');
const todayPrimaryMetaEl = document.getElementById('todayPrimaryMeta');
const todayPrimaryBtn = document.getElementById('todayPrimaryBtn');
const todaySecondaryTitleEl = document.getElementById('todaySecondaryTitle');
const todaySecondaryMetaEl = document.getElementById('todaySecondaryMeta');
const todaySecondaryBtn = document.getElementById('todaySecondaryBtn');
const modeKpiSummaryEl = document.getElementById('modeKpiSummary');
const modeKpiSessionsEl = document.getElementById('modeKpiSessions');
const modeKpiStarterEl = document.getElementById('modeKpiStarter');
const modeKpiPowerEl = document.getElementById('modeKpiPower');
const lifetimeDashboardPriceEl = document.getElementById('lifetimeDashboardPrice');
const lifetimeOfferPillEl = document.getElementById('lifetimeOfferPill');
const lifetimeDashboardOfferNoteEl = document.getElementById('lifetimeDashboardOfferNote');
const veteranDiscountModalEl = document.getElementById('veteranDiscountModal');
const veteranDiscountCodeValueEl = document.getElementById('veteranDiscountCodeValue');
const veteranCopyCodeBtn = document.getElementById('veteranCopyCodeBtn');
const veteranDismissBtn = document.getElementById('veteranDismissBtn');

const DASHBOARD_MODE_KEY = 'rr_dashboard_mode_v1';
const DASHBOARD_ADVANCED_KEY = 'rr_dashboard_advanced_v1';
const VETERAN_POPUP_STORAGE_KEY = 'rr_veteran_popup_seen_v1';
let dashboardMode = 'starter';
let advancedInsightsVisible = false;
let latestTrackerStats = {
  total: 0,
  saved: 0,
  ready: 0,
  applied: 0,
  interview: 0,
  offer: 0,
  rejected: 0
};
let activePlanGuide = 'pro';

const PLAN_GUIDE_CONTENT = {
  pro: {
    tier: 'PRO PLAN',
    title: 'Pro is built for faster application output',
    subtitle: 'Use Pro when your bottleneck is creating strong, customized application materials quickly.',
    audience: 'Job seekers who want stronger resumes and tailored applications without spending hours rewriting from scratch.',
    outcome: 'Primary outcome: ship better application materials consistently so you can apply to more high-fit roles every week.',
    narrative: 'Pro turns RoleRocket from a tracker into an application production system. It focuses on the outputs that improve conversion early in the funnel.',
    bullets: [
      'Resume Generator creates role-targeted versions faster.',
      'Cover Letter AI removes blank-page friction for each application.',
      'Job Match Analysis helps decide which roles deserve your time first.'
    ],
    signals: ['Application Speed', 'Tailored Output', 'Priority Focus'],
    steps: ['Prioritize best-fit roles', 'Tailor resume fast', 'Generate cover letter', 'Submit with more confidence'],
    jumpLabel: 'Jump to Pro pricing card'
  },
  premium: {
    tier: 'PREMIUM PLAN',
    title: 'Premium is for people ready to execute at higher volume',
    subtitle: 'Choose Premium when you already know what to apply for and need better speed, quality control, and conversion support.',
    audience: 'Candidates who want ATS optimization, interview prep, and faster application execution on roles already in motion.',
    outcome: 'Primary outcome: move more roles from interesting to applied while improving recruiter-readiness before each submission.',
    narrative: 'Premium adds the workflow tools that sharpen your materials and reduce friction between finding a role and actually getting the application out.',
    bullets: [
      'ATS Optimizer surfaces keyword and readability gaps before you apply.',
      'Interview Prep AI helps you prepare while opportunities are still warm.',
      '1-Click Apply shortens the jump from ready queue to completed application.'
    ],
    signals: ['Execution Speed', 'ATS Readiness', 'Interview Lift'],
    steps: ['Audit resume for ATS', 'Strengthen weak bullets', 'Prep likely interview questions', 'Apply from your ready queue'],
    jumpLabel: 'Jump to Premium pricing card'
  },
  elite: {
    tier: 'ELITE PLAN',
    title: 'Elite is for high-stakes searches and stronger positioning',
    subtitle: 'Elite is best when the target role matters enough that strategy, positioning, and timing all need to improve together.',
    audience: 'Professionals targeting more selective roles, stronger compensation, or a faster climb where strategy matters as much as output.',
    outcome: 'Primary outcome: make better search decisions, not just better application documents, so your effort goes where it has the highest upside.',
    narrative: 'Elite layers strategic coaching and premium insight on top of execution, so RoleRocket helps you choose better opportunities and show up sharper in each one.',
    bullets: [
      'Career Coach AI gives strategic guidance on what to pursue next.',
      'Premium insights surface where your momentum is strongest.',
      'Priority processing keeps feedback loops tighter when speed matters.'
    ],
    signals: ['Strategic Depth', 'High-Stakes Support', 'Faster Feedback'],
    steps: ['Refine role strategy', 'Pressure-test positioning', 'Execute on top opportunities', 'Adjust from signal'],
    jumpLabel: 'Jump to Elite pricing card'
  },
  lifetime: {
    tier: 'LIFETIME ACCESS',
    title: 'Lifetime is the ownership option for long-term use',
    subtitle: 'Choose Lifetime if you want one purchase that covers this search and future transitions without monthly decisions.',
    audience: 'People who expect to use RoleRocket across multiple job changes, promotions, or pivots and want permanent access.',
    outcome: 'Primary outcome: lock in every current tool and future release without recurring billing pressure or downgrade decisions.',
    narrative: 'Lifetime is not just a pricing option. It is the commitment path for users who want RoleRocket as durable career infrastructure instead of a temporary subscription.',
    bullets: [
      'Everything included means no feature gating across plan tiers.',
      'No monthly payments keeps your cost predictable forever.',
      'Future features remain included as the product expands.'
    ],
    signals: ['One-Time Purchase', 'Permanent Access', 'Future Releases'],
    steps: ['Buy once', 'Keep all paid tools active', 'Use RoleRocket for every future search', 'Avoid subscription churn'],
    jumpLabel: 'Jump to Lifetime pricing card'
  }
};

// ─── Security helpers ──────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url) {
  try {
    const u = new URL(String(url || ''), window.location.origin);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* fall through */ }
  return '#';
}

function getSidebarPlanButtons() {
  return Array.from(document.querySelectorAll('[data-sidebar-plan-btn]'));
}

function setActivePlanGuideButton(plan) {
  getSidebarPlanButtons().forEach((button) => {
    const isActive = button.dataset.sidebarPlanBtn === plan;
    button.classList.toggle('plan-info-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setActivePlanCard(plan) {
  document.querySelectorAll('[data-plan-card]').forEach((card) => {
    card.classList.toggle('plan-focus', card.dataset.planCard === plan);
  });
}

function renderPlanGuide(plan) {
  const nextPlan = PLAN_GUIDE_CONTENT[plan] ? plan : 'pro';
  const content = PLAN_GUIDE_CONTENT[nextPlan];
  activePlanGuide = nextPlan;

  if (!planGuideEl) return;

  planGuideEl.dataset.planTheme = nextPlan;
  planGuideTierEl.textContent = content.tier;
  planGuideTitleEl.textContent = content.title;
  planGuideSubtitleEl.textContent = content.subtitle;
  planGuideAudienceEl.textContent = content.audience;
  planGuideOutcomeEl.textContent = content.outcome;
  planGuideNarrativeEl.textContent = content.narrative;
  planGuideJumpBtn.textContent = content.jumpLabel;
  planGuideSignalsEl.innerHTML = content.signals.map((item) => `<span class="plan-guide-signal">${escapeHtml(item)}</span>`).join('');
  planGuideBulletsEl.innerHTML = content.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  planGuideStepsEl.innerHTML = content.steps.map((item) => `<span>${escapeHtml(item)}</span>`).join('');

  setActivePlanGuideButton(nextPlan);
  setActivePlanCard(nextPlan);
}

function showPlanGuide(plan, scroll = true) {
  setAdvancedInsightsVisible(true, { persist: true });
  renderPlanGuide(plan);
  if (scroll && planGuideEl) {
    planGuideEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setAdvancedInsightsVisible(visible, { persist = true } = {}) {
  advancedInsightsVisible = Boolean(visible);

  advancedSectionEls.forEach((section) => {
    section.hidden = !advancedInsightsVisible;
  });

  if (advancedInsightsBtn) {
    advancedInsightsBtn.textContent = advancedInsightsVisible ? 'Hide Advanced' : 'Show Advanced';
    advancedInsightsBtn.setAttribute('aria-pressed', advancedInsightsVisible ? 'true' : 'false');
  }

  if (persist) {
    localStorage.setItem(DASHBOARD_ADVANCED_KEY, advancedInsightsVisible ? 'show' : 'hide');
  }
}

function initAdvancedInsights() {
  const saved = localStorage.getItem(DASHBOARD_ADVANCED_KEY);
  setAdvancedInsightsVisible(saved === 'show', { persist: false });
}

// ─── Toast notifications ───────────────────────────────────────────────────
const TOAST_ICONS = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };

function showToast(message, type = 'success', durationMs = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) { console.warn('[toast]', message); return; }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = TOAST_ICONS[type] || 'ℹ️';

  const msg = document.createElement('span');
  msg.className = 'toast-msg';
  msg.textContent = message;

  toast.append(icon, msg);
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, durationMs);
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

function removeUrlQueryParams(paramNames = []) {
  if (!paramNames.length) return;
  const url = new URL(window.location.href);
  let changed = false;
  paramNames.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return;

  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash || ''}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function closeVeteranDiscountPopup() {
  if (!veteranDiscountModalEl) return;
  veteranDiscountModalEl.hidden = true;
  veteranDiscountModalEl.setAttribute('aria-hidden', 'true');
}

async function copyVeteranCode() {
  const code = String(veteranDiscountCodeValueEl?.textContent || '').trim();
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    showToast('Veteran code copied. Use it at checkout.');
  } catch {
    showToast('Could not copy automatically. You can still use the visible code.', 'warn');
  }
}

async function maybeShowVeteranDiscountPopup(user, { force = false } = {}) {
  if (!user?.veteranVerified) return;

  // Only show this modal when explicitly requested (for example after verification callback).
  // Prevents popup from becoming the first thing users see on normal dashboard visits.
  if (!force) return;

  const userId = String(user._id || user.id || 'me').trim();
  const storageKey = `${VETERAN_POPUP_STORAGE_KEY}:${userId}`;
  if (!force && localStorage.getItem(storageKey) === '1') return;

  let code = 'VETERAN10';
  try {
    const data = await api('/api/veteran/discount-code', { method: 'GET' }, { retries: 0, timeoutMs: 5000 });
    if (data?.code) code = String(data.code).trim();
  } catch (err) {
    console.warn('Veteran code fetch warning:', err?.message || err);
  }

  localStorage.setItem(storageKey, '1');

  if (!veteranDiscountModalEl || !veteranDiscountCodeValueEl) {
    showToast(`Veteran discount ready. Use code ${code}.`, 'success', 7000);
    return;
  }

  veteranDiscountCodeValueEl.textContent = code;
  veteranDiscountModalEl.hidden = false;
  veteranDiscountModalEl.setAttribute('aria-hidden', 'false');
}

veteranCopyCodeBtn?.addEventListener('click', copyVeteranCode);
veteranDismissBtn?.addEventListener('click', closeVeteranDiscountPopup);
veteranDiscountModalEl?.addEventListener('click', (event) => {
  if (event.target === veteranDiscountModalEl) {
    closeVeteranDiscountPopup();
  }
});

// ─── AI output renderer ────────────────────────────────────────────────────
function setAILoading(el, label = 'Generating\u2026') {
  if (!el) return;
  el.innerHTML = `<div class="ai-output-loading">${escapeHtml(label)}</div>`;
}

function renderAIOutput(text, el) {
  if (!el) return;
  const rawText = String(text || '');
  const regionLabel = el.getAttribute('aria-label') || 'AI result';

  el.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'ai-output-header';

  const labelEl = document.createElement('span');
  labelEl.className = 'ai-output-label';
  labelEl.textContent = regionLabel;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'ai-copy-output-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(rawText).then(() => {
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = rawText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    });
  });

  header.append(labelEl, copyBtn);

  const body = document.createElement('div');
  body.className = 'ai-output-body';

  let currentList = null;

  rawText.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { currentList = null; return; }

    // Section heading: **text** alone or ALL-CAPS 5+ chars
    if (/^\*\*[^*]+\*\*:?\s*$/.test(line) || /^[A-Z][A-Z\s\d:]{4,}$/.test(line)) {
      currentList = null;
      const h = document.createElement('div');
      h.className = 'ai-section-heading';
      h.textContent = line.replace(/\*\*/g, '');
      body.appendChild(h);
      return;
    }

    // Bullet lines
    if (/^[-•*✦]/.test(line) || /^\d+\.\s/.test(line)) {
      if (!currentList) {
        currentList = document.createElement('ul');
        currentList.className = 'ai-bullet-list';
        body.appendChild(currentList);
      }
      const li = document.createElement('li');
      li.className = 'ai-bullet-item';
      li.textContent = line.replace(/^[-•*✦]\s*/, '').replace(/^\d+\.\s*/, '');
      currentList.appendChild(li);
      return;
    }

    // Regular paragraph with optional inline **bold**
    currentList = null;
    const p = document.createElement('p');
    p.className = 'ai-paragraph';
    line.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        const strong = document.createElement('strong');
        strong.textContent = part.replace(/\*\*/g, '');
        p.appendChild(strong);
      } else {
        p.appendChild(document.createTextNode(part));
      }
    });
    body.appendChild(p);
  });

  el.appendChild(header);
  el.appendChild(body);
}

// ─── Saved resume helpers ──────────────────────────────────────────────────
const RESUME_FIELD_IDS = ['resume', 'coverResume', 'matchResume', 'jobResume', 'careerCoachResume', 'iaResume'];

async function loadSavedResume() {
  try {
    const data = await api('/api/resume/latest', { method: 'GET' }, { retries: 0, timeoutMs: 5000 });
    if (!data.resume?.content) return;

    const content = data.resume.content;
    const preview = content.slice(0, 90).replace(/\n/g, ' ') + (content.length > 90 ? '\u2026' : '');

    const previewEl = document.getElementById('savedResumePreview');
    const stateEl = document.getElementById('savedResumeState');
    if (previewEl) previewEl.textContent = preview;
    if (stateEl) stateEl.textContent = 'Saved';

    RESUME_FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) el.value = content;
    });

    track('saved_resume_loaded', 'personalization', { chars: content.length });
  } catch {
    // No saved resume yet — silently skip
  }
}

function applyResumeToAllFields(content, { onlyEmpty = false } = {}) {
  RESUME_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!onlyEmpty || !el.value.trim()) {
      el.value = content;
    }
  });
}

async function saveMasterResume(content) {
  return api('/api/resume/save', {
    method: 'POST',
    body: JSON.stringify({ content, title: 'Master Resume' })
  });
}

async function extractResumeTextFromFile(file) {
  if (!file) throw new Error('Choose a file to upload.');

  const name = String(file.name || '').toLowerCase();
  const supportsTextRead =
    String(file.type || '').startsWith('text/') || /\.(txt|md|rtf)$/.test(name);

  if (!supportsTextRead) {
    throw new Error('Only TXT, MD, and RTF files are supported for upload right now.');
  }

  const raw = await file.text();
  const cleaned = String(raw || '').replace(/\u0000/g, '').trim();

  if (!cleaned) {
    throw new Error('That file is empty. Please choose another resume file.');
  }

  return cleaned;
}

function initSavedResumeManager() {
  const toggleBtn = document.getElementById('toggleSavedResumeFormBtn');
  const confirmBtn = document.getElementById('confirmSaveMasterResumeBtn');
  const cancelBtn = document.getElementById('cancelSavedResumeBtn');
  const uploadBtn = document.getElementById('uploadResumeBtn');
  const uploadInput = document.getElementById('resumeUploadInput');
  const editWrap = document.getElementById('savedResumeEditWrap');
  const input = document.getElementById('masterResumeText');
  const previewEl = document.getElementById('savedResumePreview');
  const stateEl = document.getElementById('savedResumeState');

  if (!toggleBtn || !confirmBtn || !cancelBtn || !editWrap || !input) return;

  toggleBtn.addEventListener('click', async () => {
    const isOpen = editWrap.style.display !== 'none';
    if (isOpen) {
      editWrap.style.display = 'none';
      return;
    }

    try {
      const data = await api('/api/resume/latest', { method: 'GET' }, { retries: 0, timeoutMs: 5000 });
      input.value = data.resume?.content || '';
    } catch {
      input.value = '';
    }

    editWrap.style.display = 'flex';
    input.focus();
  });

  cancelBtn.addEventListener('click', () => {
    editWrap.style.display = 'none';
  });

  confirmBtn.addEventListener('click', async () => {
    const content = String(input.value || '').trim();
    if (!content) {
      showToast('Paste your resume before saving.', 'warn');
      return;
    }

    setButtonLoading(confirmBtn, 'Saving...');
    try {
      await saveMasterResume(content);
      applyResumeToAllFields(content);

      const preview = content.slice(0, 90).replace(/\n/g, ' ') + (content.length > 90 ? '...' : '');
      if (previewEl) previewEl.textContent = preview;
      if (stateEl) stateEl.textContent = 'Saved';

      showToast('Saved. Resume auto-filled across all tools.');
      editWrap.style.display = 'none';
      track('saved_resume_updated', 'personalization', { chars: content.length });
    } catch (err) {
      showToast(`Resume save failed: ${err.message}`, 'error');
    } finally {
      clearButtonLoading(confirmBtn);
    }
  });

  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', () => {
      uploadInput.click();
    });

    uploadInput.addEventListener('change', async () => {
      const file = uploadInput.files && uploadInput.files[0] ? uploadInput.files[0] : null;
      if (!file) return;

      setButtonLoading(uploadBtn, 'Uploading...');

      try {
        const content = await extractResumeTextFromFile(file);
        await saveMasterResume(content);
        applyResumeToAllFields(content);
        input.value = content;

        const preview = content.slice(0, 90).replace(/\n/g, ' ') + (content.length > 90 ? '...' : '');
        if (previewEl) previewEl.textContent = preview;
        if (stateEl) stateEl.textContent = 'Saved';

        showToast('Resume uploaded and auto-filled across all tools.');
        track('saved_resume_uploaded', 'personalization', {
          chars: content.length,
          ext: String(file.name || '').split('.').pop() || 'unknown'
        });
      } catch (err) {
        showToast(`Resume upload failed: ${err.message}`, 'error');
      } finally {
        uploadInput.value = '';
        clearButtonLoading(uploadBtn);
      }
    });
  }
}

function initMobileSidebar() {
  const menuToggleBtn = document.getElementById('mobileMenuBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebar = document.querySelector('.sidebar');
  if (!menuToggleBtn || !sidebarOverlay || !sidebar) return;

  const setOpen = (open) => {
    document.body.classList.toggle('sidebar-open', open);
    menuToggleBtn.setAttribute('aria-expanded', String(open));
  };

  menuToggleBtn.addEventListener('click', () => {
    setOpen(!document.body.classList.contains('sidebar-open'));
  });

  sidebarOverlay.addEventListener('click', () => setOpen(false));

  sidebar.querySelectorAll('button, a').forEach((el) => {
    el.addEventListener('click', () => {
      if (window.innerWidth <= 700) setOpen(false);
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) setOpen(false);
  });
}

const sessionId = (() => {
  const existing = localStorage.getItem('rr_dashboard_sid');
  if (existing) return existing;
  const next = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('rr_dashboard_sid', next);
  return next;
})();

// Only declare telemetryQueue if not already declared (prevents duplicate errors)
window.telemetryQueue = window.telemetryQueue || [];
const telemetryQueue = window.telemetryQueue;

function setOfflineBanner(offline) {
  if (!offlineBanner) return;
  if (offline) {
    offlineBanner.hidden = false;
  } else {
    offlineBanner.hidden = true;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(path, options, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(apiUrl(path), { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function enqueueTelemetry(payload) {
  telemetryQueue.push(payload);
  if (telemetryQueue.length > 100) telemetryQueue.shift();
}

function track(event, funnel = '', meta = {}) {
  enqueueTelemetry({
    event,
    funnel,
    sessionId,
    page: 'dashboard',
    variant: abVariant,
    ts: new Date().toISOString(),
    meta: {
      mode: dashboardMode,
      ...meta
    }
  });
}

async function flushTelemetry() {
  if (!telemetryQueue.length || !navigator.onLine) return;

  const batch = telemetryQueue.splice(0, 15);

  await Promise.allSettled(
    batch.map((evt) =>
      fetch(apiUrl('/api/telemetry'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(evt),
        keepalive: true
      })
    )
  );
}

setInterval(() => {
  flushTelemetry().catch(() => {});
}, 10000);

window.addEventListener('online', () => {
  setOfflineBanner(false);
  track('network_online', 'reliability');
  flushTelemetry().catch(() => {});
});

window.addEventListener('offline', () => {
  setOfflineBanner(true);
  track('network_offline', 'reliability');
});

window.addEventListener('beforeunload', () => {
  track('session_end', 'engagement', { hasJobs: lastFoundJobs.length > 0 });
  flushTelemetry().catch(() => {});
});

setOfflineBanner(!navigator.onLine);

async function api(path, options = {}, config = {}) {
  const isFormData = options.body instanceof FormData;
  const retries = config.retries ?? API_DEFAULT_RETRIES;
  const timeoutMs = config.timeoutMs ?? API_TIMEOUT_MS;

  if (!navigator.onLine) {
    track('api_blocked_offline', 'reliability', { path });
    throw new Error('You appear to be offline. Reconnect and try again.');
  }

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(
        path,
        {
          ...options,
          headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
          }
        },
        timeoutMs
      );

      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const err = new Error(data.error || data.message || 'Request failed');
        err.status = res.status;
        throw err;
      }

      return data;
    } catch (err) {
      const isAbort = err.name === 'AbortError';
      const retryable = isAbort || RETRYABLE_STATUS.has(err.status);
      lastError = isAbort ? new Error('Request timed out. Please try again.') : err;

      if (attempt >= retries || !retryable) {
        track('api_failed', 'reliability', {
          path,
          attempt,
          status: err.status || null,
          message: String(lastError.message || '')
        });
        throw lastError;
      }

      await sleep(350 * (attempt + 1));
      attempt += 1;
    }
  }

  throw lastError || new Error('Request failed');
}

function normalizePlan(plan) {
  const allowed = ['free', 'pro', 'premium', 'elite', 'lifetime'];
  return allowed.includes(plan) ? plan : 'free';
}

function planLevel(plan) {
  const normalized = normalizePlan(plan);

  if (normalized === 'free') return 0;
  if (normalized === 'pro') return 1;
  if (normalized === 'premium') return 2;
  if (normalized === 'elite') return 3;
  if (normalized === 'lifetime') return 4;

  return 0;
}

function hasPlan(requiredPlan) {
  return planLevel(currentUserPlan) >= planLevel(requiredPlan);
}

function formatPlan(plan) {
  return `${plan.charAt(0).toUpperCase()}${plan.slice(1)} Plan`;
}

function applyLocks() {
  const lockableCards = document.querySelectorAll('.lockable');

  lockableCards.forEach((card) => {
    const requiredPlan = card.dataset.plan;

    if (hasPlan(requiredPlan)) {
      card.classList.remove('locked-card');
    } else {
      card.classList.add('locked-card');
    }
  });

  updatePlanAccessChips();
}

function updatePlanAccessChips() {
  document.querySelectorAll('[data-plan-lock-chip]').forEach((chip) => {
    const plan = normalizePlan(chip.dataset.planLockChip || 'free');

    if (plan === currentUserPlan) {
      chip.textContent = 'Current Plan';
      chip.className = 'plan-lock-chip current';
      return;
    }

    if (hasPlan(plan)) {
      chip.textContent = 'Unlocked';
      chip.className = 'plan-lock-chip unlocked';
      return;
    }

    chip.textContent = 'Locked';
    chip.className = 'plan-lock-chip locked';
  });
}

function setDashboardMode(mode, options = {}) {
  const { persist = true } = options;
  const nextMode = mode === 'power' ? 'power' : 'starter';
  dashboardMode = nextMode;
  document.body.setAttribute('data-dashboard-mode', nextMode);

  if (persist) {
    localStorage.setItem(DASHBOARD_MODE_KEY, nextMode);
  }

  if (starterModeBtn) {
    starterModeBtn.setAttribute('aria-pressed', String(nextMode === 'starter'));
  }
  if (powerModeBtn) {
    powerModeBtn.setAttribute('aria-pressed', String(nextMode === 'power'));
  }

  if (modeSummary) {
    modeSummary.textContent =
      nextMode === 'starter'
        ? 'Starter mode keeps only core daily actions visible.'
        : 'Power mode shows all AI tools, personalization panels, and advanced controls.';
  }

  updateTodayRail();
}

function pickModeByMaturity({ plan, tracker }) {
  const level = planLevel(plan || 'free');
  const total = Number(tracker?.total || 0);
  const ready = Number(tracker?.ready || 0);
  const applied = Number(tracker?.applied || 0);

  if (level >= 2 || applied >= 2 || total >= 8 || ready >= 3) {
    return 'power';
  }

  return 'starter';
}

async function initDashboardMode() {
  const saved = localStorage.getItem(DASHBOARD_MODE_KEY);

  if (saved === 'starter' || saved === 'power') {
    setDashboardMode(saved, { persist: false });
  } else {
    try {
      const trackerData = await api('/api/jobs', { method: 'GET' }, { retries: 0, timeoutMs: 6000 });
      const jobs = trackerData.jobs || [];
      const counts = {
        total: jobs.length,
        saved: 0,
        ready: 0,
        applied: 0,
        interview: 0,
        offer: 0,
        rejected: 0
      };

      jobs.forEach((job) => {
        const status = String(job.status || 'saved').toLowerCase();
        if (counts[status] !== undefined) counts[status] += 1;
      });

      latestTrackerStats = counts;
    } catch {
      // Keep defaults if we cannot pre-read pipeline state.
    }

    const autoMode = pickModeByMaturity({
      plan: currentUserPlan,
      tracker: latestTrackerStats
    });

    setDashboardMode(autoMode);
    track('dashboard_mode_auto_selected', 'activation', {
      mode: autoMode,
      plan: currentUserPlan,
      totalJobs: latestTrackerStats.total,
      readyJobs: latestTrackerStats.ready,
      appliedJobs: latestTrackerStats.applied
    });
  }

  starterModeBtn?.addEventListener('click', () => {
    setDashboardMode('starter');
    track('dashboard_mode_changed', 'activation', { mode: 'starter', source: 'manual' });
  });

  powerModeBtn?.addEventListener('click', () => {
    setDashboardMode('power');
    track('dashboard_mode_changed', 'activation', { mode: 'power', source: 'manual' });
  });
}

function initPricingExperiment() {
  const key = 'rr_ab_pricing_variant_v1';
  const persisted = localStorage.getItem(key);
  abVariant = persisted || (Math.random() < 0.5 ? 'A' : 'B');
  if (!persisted) localStorage.setItem(key, abVariant);

  const proSubtext = document.getElementById('proSubtext');
  const premiumSubtext = document.getElementById('premiumSubtext');
  const eliteSubtext = document.getElementById('eliteSubtext');
  const proCta = document.getElementById('proUpgradeCta');
  const premiumCta = document.getElementById('premiumUpgradeCta');
  const eliteCta = document.getElementById('eliteUpgradeCta');

  if (abVariant === 'B') {
    if (proSubtext) proSubtext.textContent = 'Tailor resume + cover letter in minutes instead of hours.';
    if (premiumSubtext) premiumSubtext.textContent = 'Move from top matches to applications with ATS + 1-Click flow.';
    if (eliteSubtext) eliteSubtext.textContent = 'Real-time interview assist and strategy for high-stakes opportunities.';
    if (proCta) proCta.textContent = 'Start Pro';
    if (premiumCta) premiumCta.textContent = 'Unlock Premium';
    if (eliteCta) eliteCta.textContent = 'Activate Elite';
  }

  const promptMarkup = `
    <aside class="ia-prompt" role="complementary" aria-label="Interview Assist prompt">
      <div>
        <strong>New: Live Interview Assist Mode</strong>
        <p>Type a question mid-interview and get a concise, coach-structured answer instantly.</p>
      </div>
      <button id="jumpToIaBtn" class="secondary-btn">See Interview Assist</button>
    </aside>
  `;

  const slot = abVariant === 'A'
    ? document.getElementById('iaPromptMid')
    : document.getElementById('iaPromptTop');

  if (slot) slot.innerHTML = promptMarkup;

  document.getElementById('jumpToIaBtn')?.addEventListener('click', () => {
    document.getElementById('interviewAssistSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    track('ia_prompt_clicked', 'conversion', { variant: abVariant, placement: abVariant === 'A' ? 'mid' : 'top' });
  });

  track('pricing_variant_assigned', 'conversion', { variant: abVariant });
}

async function loadUserPlan() {
  try {
    const data = await api('/api/me', { method: 'GET' });

    if (data.user) {
      currentUserPlan = normalizePlan(data.user.plan || 'free');
      if (planBadgeEl) planBadgeEl.textContent = formatPlan(currentUserPlan);
      renderPlanGuide(currentUserPlan === 'free' ? 'pro' : currentUserPlan);
      applyLocks();
      updateTodayRail();
      track('user_plan_loaded', 'activation', { plan: currentUserPlan });

      const params = new URLSearchParams(window.location.search);
      const forceVeteranPopup = params.get('veteran') === 'verified';
      await maybeShowVeteranDiscountPopup(data.user, { force: forceVeteranPopup });
      if (forceVeteranPopup) {
        removeUrlQueryParams(['veteran']);
      }
    }
  } catch {
    currentUserPlan = 'free';
    if (planBadgeEl) planBadgeEl.textContent = 'Free Plan';
    renderPlanGuide('pro');
    applyLocks();
    updateTodayRail();
  }
}

async function syncLifetimeOfferUi() {
  if (!lifetimeDashboardPriceEl || !lifetimeOfferPillEl || !lifetimeDashboardOfferNoteEl) return;

  try {
    const data = await api('/api/lifetime-offer-status', { method: 'GET' }, { retries: 0, timeoutMs: 5000 });

    if (data?.offerActive) {
      lifetimeDashboardPriceEl.innerHTML = '<span class="price-original">$249</span> $199<span> one-time</span>';
      lifetimeOfferPillEl.textContent = '🔥 LIMITED OFFER';
      lifetimeDashboardOfferNoteEl.textContent = `Limited offer: $199 for the first 50 customers. ${data.remaining || 0} spots left.`;
      return;
    }

    lifetimeDashboardPriceEl.innerHTML = '$249<span> one-time</span>';
    lifetimeOfferPillEl.textContent = '🔥 LIFETIME ACCESS';
    lifetimeDashboardOfferNoteEl.textContent = 'Limited offer sold out. Lifetime is now $249 one-time.';
  } catch (err) {
    console.warn('Lifetime offer UI sync failed:', err?.message || err);
  }
}

function setCheckoutBanner(message, mode = 'success') {
  if (!checkoutBanner) return;
  checkoutBanner.textContent = message;
  checkoutBanner.hidden = false;

  if (mode === 'processing') {
    checkoutBanner.classList.add('processing');
  } else {
    checkoutBanner.classList.remove('processing');
  }
}

function clearCheckoutParams() {
  const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function refreshPlanAfterCheckout(maxAttempts = 4) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const data = await api('/api/me', { method: 'GET' }, { retries: 0, timeoutMs: 8000 });
      const nextPlan = normalizePlan(data.user?.plan || 'free');

      currentUserPlan = nextPlan;
      if (planBadgeEl) planBadgeEl.textContent = formatPlan(currentUserPlan);
      applyLocks();

      if (nextPlan !== 'free') {
        return true;
      }
    } catch {
      // Keep polling briefly in case webhook persistence is slightly delayed.
    }

    await sleep(900);
  }

  return false;
}

async function handleCheckoutRedirectState() {
  const params = new URLSearchParams(window.location.search);
  const isSubscriptionSuccess = params.get('success') === 'true';
  const isLifetimeSuccess = params.get('lifetime') === 'true';

  if (!isSubscriptionSuccess && !isLifetimeSuccess) return;

  // Restore last page in history so back arrow works as expected
  try {
    const lastPage = sessionStorage.getItem('rr_last_page_before_checkout');
    if (lastPage) {
      window.history.replaceState({}, document.title, lastPage);
      sessionStorage.removeItem('rr_last_page_before_checkout');
    }
  } catch (e) {}

  setCheckoutBanner('Payment received. Verifying your plan unlock...', 'processing');
  track('checkout_returned', 'checkout', {
    type: isLifetimeSuccess ? 'lifetime' : 'subscription'
  });

  const unlocked = await refreshPlanAfterCheckout();

  if (unlocked) {
    setCheckoutBanner(
      `Success. Your ${formatPlan(currentUserPlan)} is active and premium tools are now unlocked.`
    );
    track('checkout_unlock_confirmed', 'checkout', { plan: currentUserPlan });
  } else {
    setCheckoutBanner('Payment succeeded. Your plan is still syncing. Refresh in a few seconds if needed.');
    track('checkout_unlock_pending', 'checkout');
  }

  clearCheckoutParams();
}

function encodeJob(job) {
  return encodeURIComponent(JSON.stringify(job));
}

function formatPostedAgo(postedAt) {
  if (!postedAt) return 'Posted date unavailable';

  const parsed = new Date(postedAt);
  if (Number.isNaN(parsed.getTime())) return 'Posted date unavailable';

  const deltaMs = Date.now() - parsed.getTime();
  if (deltaMs < 0) return 'Posted just now';

  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 60) return minutes <= 1 ? 'Posted 1 minute ago' : `Posted ${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'Posted 1 hour ago' : `Posted ${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? 'Posted 1 day ago' : `Posted ${days} days ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'Posted 1 month ago' : `Posted ${months} months ago`;

  const years = Math.floor(months / 12);
  return years === 1 ? 'Posted 1 year ago' : `Posted ${years} years ago`;
}

function createSearchJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card';

  const titleEl = document.createElement('strong');
  titleEl.textContent = job.title || 'Untitled Job';
  const companyEl = document.createElement('span');
  companyEl.textContent = job.company || 'Unknown Company';
  const locationEl = document.createElement('small');
  locationEl.textContent = `📍 ${job.location || 'Unknown Location'}`;
  const matchEl = document.createElement('small');
  matchEl.textContent = `🔥 Match: ${job.matchScore || 0}%`;
  const sourceEl = document.createElement('small');
  sourceEl.textContent = `Source: ${job.source || 'Imported'}`;
  const postedEl = document.createElement('small');
  postedEl.className = 'job-posted-age';
  postedEl.textContent = formatPostedAgo(job.postedAt || job.createdAt);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'job-card-actions';

  const viewLink = document.createElement('a');
  viewLink.href = safeUrl(job.link);
  viewLink.target = '_blank';
  viewLink.rel = 'noopener noreferrer';
  const sourceName = String(job.source || '').trim();
  viewLink.textContent = sourceName ? `Apply on ${sourceName}` : 'Apply Now';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Job';
  saveBtn.addEventListener('click', () => window.saveFoundJob(encodeJob(job)));

  const oneClickBtn = document.createElement('button');
  oneClickBtn.textContent = 'Send to 1-Click Apply';
  oneClickBtn.addEventListener('click', () => window.sendJobToOneClick(encodeJob(job)));

  const linkedinLink = document.createElement('a');
  linkedinLink.href = safeUrl(job.linkedinSearchUrl);
  linkedinLink.target = '_blank';
  linkedinLink.rel = 'noopener noreferrer';
  linkedinLink.textContent = 'Search LinkedIn';

  actionsDiv.append(viewLink, saveBtn, oneClickBtn, linkedinLink);

  const br = () => document.createElement('br');
  wrapper.append(titleEl, br(), companyEl, br(), locationEl, br(), matchEl, br(), sourceEl, br(), postedEl, br(), br(), actionsDiv);

  return wrapper;
}

function createImportedJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card';

  const titleEl = document.createElement('strong');
  titleEl.textContent = job.title || 'Imported Role';
  const companyEl = document.createElement('span');
  companyEl.textContent = job.company || 'Imported Company';
  const locationEl = document.createElement('small');
  locationEl.textContent = `📍 ${job.location || 'Remote'}`;
  const matchEl = document.createElement('small');
  matchEl.textContent = `🔥 Match: ${job.matchScore || 0}%`;
  const sourceEl = document.createElement('small');
  sourceEl.textContent = `Source: ${job.source || 'Imported Job'}`;
  const postedEl = document.createElement('small');
  postedEl.className = 'job-posted-age';
  postedEl.textContent = formatPostedAgo(job.postedAt || job.createdAt);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'job-card-actions';

  const viewLink = document.createElement('a');
  viewLink.href = safeUrl(job.link);
  viewLink.target = '_blank';
  viewLink.rel = 'noopener noreferrer';
  viewLink.textContent = 'Open Original Job';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Job';
  saveBtn.addEventListener('click', () => window.saveFoundJob(encodeJob(job)));

  const oneClickBtn = document.createElement('button');
  oneClickBtn.textContent = 'Send to 1-Click Apply';
  oneClickBtn.addEventListener('click', () => window.sendJobToOneClick(encodeJob(job)));

  const linkedinLink = document.createElement('a');
  linkedinLink.href = safeUrl(job.linkedinSearchUrl);
  linkedinLink.target = '_blank';
  linkedinLink.rel = 'noopener noreferrer';
  linkedinLink.textContent = 'Search LinkedIn';

  actionsDiv.append(viewLink, saveBtn, oneClickBtn, linkedinLink);

  const br = () => document.createElement('br');
  wrapper.append(titleEl, br(), companyEl, br(), locationEl, br(), matchEl, br(), sourceEl, br(), postedEl, br(), br(), actionsDiv);

  return wrapper;
}

function renderFoundJobs(jobs = []) {
  jobsListEl.innerHTML = '';
  lastFoundJobs = jobs;
  updateDynamicCoachInsights();

  if (!jobs.length) {
    jobsListEl.innerHTML = '<div class="empty-state">No jobs found.</div>';
    return;
  }

  jobs.forEach((job) => {
    jobsListEl.appendChild(createSearchJobCard(job));
  });
}

function createTopJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card';

  const titleEl = document.createElement('strong');
  titleEl.textContent = job.title || 'Untitled Job';
  const companyEl = document.createElement('span');
  companyEl.textContent = job.company || 'Unknown Company';
  const urgencyEl = document.createElement('small');
  urgencyEl.textContent = `⚡ Urgency: ${job.urgencyLabel || 'Unknown'}`;
  const matchEl = document.createElement('small');
  matchEl.textContent = `🔥 Match: ${job.matchScore || 0}%`;
  const postedEl = document.createElement('small');
  postedEl.className = 'job-posted-age';
  postedEl.textContent = formatPostedAgo(job.postedAt || job.createdAt);

  const br = () => document.createElement('br');
  wrapper.append(titleEl, br(), companyEl, br(), urgencyEl, br(), matchEl, br(), postedEl);

  return wrapper;
}

function createTrackerCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card tracker-job-card';

  const currentStatus = (job.status || 'saved').toLowerCase();

  const titleEl = document.createElement('strong');
  titleEl.textContent = job.title || 'Untitled Job';
  const companyEl = document.createElement('span');
  companyEl.textContent = job.company || 'Unknown Company';
  const locationEl = document.createElement('small');
  locationEl.textContent = job.location || '';

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tracker-actions';

  const select = document.createElement('select');
  ['saved', 'ready', 'applied', 'interview', 'offer', 'rejected'].forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    option.selected = currentStatus === status;
    select.appendChild(option);
  });
  select.addEventListener('change', () => window.updateJobStatus(String(job._id), select.value));
  actionsDiv.appendChild(select);

  const br = () => document.createElement('br');
  wrapper.append(titleEl, br(), companyEl, br(), locationEl, br(), br(), actionsDiv);

  return wrapper;
}

async function saveJobToBackend(job, status = 'saved') {
  const payload = {
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    link: job.link || '',
    description: job.description || '',
    matchScore: job.matchScore || 0,
    source: job.source || 'Imported',
    status
  };

  return api('/api/jobs/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

window.saveFoundJob = async function saveFoundJob(encodedJob) {
  try {
    const job = JSON.parse(decodeURIComponent(encodedJob));
    await saveJobToBackend(job, 'saved');
    showToast('Job saved to tracker');
    await loadTracker();
  } catch (err) {
    showToast(`Save error: ${err.message}`, 'error');
  }
};

window.sendJobToOneClick = async function sendJobToOneClick(encodedJob) {
  if (!hasPlan('premium')) {
    showToast('Upgrade to Premium to use 1-Click Apply.', 'warn');
    return;
  }

  try {
    const job = JSON.parse(decodeURIComponent(encodedJob));
    await saveJobToBackend(job, 'ready');
    showToast('Job sent to Ready queue');
    await loadTracker();
  } catch (err) {
    showToast(`1-Click Apply error: ${err.message}`, 'error');
  }
};

window.updateJobStatus = async function updateJobStatus(jobId, newStatus) {
  try {
    await api(`/api/jobs/${jobId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });

    await loadTracker();
  } catch (err) {
    showToast(`Status update error: ${err.message}`, 'error');
  }
};

function updateTodayRail() {
  if (!todayPrimaryTitleEl || !todayPrimaryMetaEl || !todayPrimaryBtn) return;

  const ready = Number(latestTrackerStats.ready || 0);
  const saved = Number(latestTrackerStats.saved || 0);
  const total = Number(latestTrackerStats.total || 0);

  if (!total && !lastFoundJobs.length) {
    todayPrimaryTitleEl.textContent = 'Start your first high-fit search sprint';
    todayPrimaryMetaEl.textContent = 'Search by role and location to build a focused pipeline quickly.';
    todayPrimaryBtn.textContent = 'Start Search';
  } else if (ready > 0 && hasPlan('premium')) {
    todayPrimaryTitleEl.textContent = `You have ${ready} ready job${ready === 1 ? '' : 's'} to apply`;
    todayPrimaryMetaEl.textContent = 'Run 1-Click Apply now while these high-fit roles are still fresh.';
    todayPrimaryBtn.textContent = 'Apply Now';
  } else if (ready > 0 && !hasPlan('premium')) {
    todayPrimaryTitleEl.textContent = `You have ${ready} ready job${ready === 1 ? '' : 's'} waiting`;
    todayPrimaryMetaEl.textContent = 'Unlock Premium to convert your ready queue in one click.';
    todayPrimaryBtn.textContent = 'Upgrade to Premium';
  } else {
    todayPrimaryTitleEl.textContent = 'Convert saved roles into ready applications';
    todayPrimaryMetaEl.textContent = 'Move top matches to Ready now so you can execute faster.';
    todayPrimaryBtn.textContent = 'Open Tracker';
  }

  if (todaySecondaryTitleEl && todaySecondaryMetaEl && todaySecondaryBtn) {
    if (saved > 0) {
      todaySecondaryTitleEl.textContent = 'Add one more role to keep your pipeline compounding';
      todaySecondaryMetaEl.textContent = 'Daily pipeline growth raises interview odds over time.';
      todaySecondaryBtn.textContent = 'Import Role';
    } else {
      todaySecondaryTitleEl.textContent = 'Import one role from any job board';
      todaySecondaryMetaEl.textContent = 'Paste any job description and instantly normalize it into your tracker.';
      todaySecondaryBtn.textContent = 'Import Role';
    }
  }
}

function updateDynamicCoachInsights() {
  if (!careerCoachInsightEl || !careerMatchSignalEl || !careerUrgencyNudgeEl) {
    return;
  }

  if (!lastFoundJobs.length) {
    careerCoachInsightEl.textContent =
      'Paste a resume and search jobs to unlock sharper career guidance.';
    careerMatchSignalEl.textContent =
      'Your strongest match signal will appear after your next job search.';
    careerUrgencyNudgeEl.textContent =
      'Search your best-fit roles and act quickly on high-match openings.';
    return;
  }

  const sorted = [...lastFoundJobs].sort(
    (a, b) => Number(b.matchScore || 0) - Number(a.matchScore || 0)
  );

  const topJob = sorted[0];
  const score = Number(topJob.matchScore || 0);
  const title = topJob.title || 'target';
  const location = topJob.location || 'your preferred market';

  if (score >= 90) {
    careerMatchSignalEl.textContent =
      `You’re a top-tier match for ${title} roles right now.`;
  } else if (score >= 80) {
    careerMatchSignalEl.textContent =
      'You’re close — a few stronger bullets could improve your odds fast.';
  } else {
    careerMatchSignalEl.textContent =
      'You need sharper targeting to compete better for this role family.';
  }

  if ((location || '').toLowerCase().includes('remote')) {
    careerCoachInsightEl.textContent =
      `Remote-friendly ${title} roles may widen your options and pay range.`;
  } else {
    careerCoachInsightEl.textContent =
      `Targeting ${location} roles could improve alignment with nearby opportunities.`;
  }

  careerUrgencyNudgeEl.textContent =
    `Best next move: save or send ${title} to 1-Click Apply while the match is fresh.`;
}

document.getElementById('findJobsBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('findJobsBtn');
  setButtonLoading(btn, 'Searching...');
  jobsListEl.innerHTML = '<div class="empty-state">Loading jobs...</div>';
  track('find_jobs_started', 'jobs_search');

  try {
    const title = document.getElementById('jobTitle').value.trim();
    const location = document.getElementById('jobLocation').value.trim();
    const resume = document.getElementById('jobResume').value;
    const cacheKey = `${title}::${location}::${(resume || '').slice(0, 300)}`.toLowerCase();

    if (localJobSearchCache.has(cacheKey)) {
      renderFoundJobs(localJobSearchCache.get(cacheKey));
      track('find_jobs_local_cache_hit', 'jobs_search');
      return;
    }

    const data = await api('/api/jobs/find', {
      method: 'POST',
      body: JSON.stringify({
        title,
        location,
        resume
      })
    }, { retries: 0, timeoutMs: 3500 });

    const jobs = data.jobs || [];
    const isHydrated = Boolean(data.meta?.hydrated);
    localJobSearchCache.set(cacheKey, jobs);
    renderFoundJobs(jobs);
    track('find_jobs_success', 'jobs_search', {
      count: jobs.length,
      title,
      location,
      source: data.meta?.source || 'unknown'
    });

    if (!isHydrated) {
      const refreshAfterMs = Number(data.meta?.refreshAfterMs || 1200);
      setTimeout(async () => {
        try {
          const fresh = await api('/api/jobs/find', {
            method: 'POST',
            body: JSON.stringify({
              title,
              location,
              resume,
              forceRefresh: true
            })
          }, { retries: 0, timeoutMs: 3000 });

          const freshJobs = fresh.jobs || [];
          localJobSearchCache.set(cacheKey, freshJobs);

          const stillSameSearch =
            document.getElementById('jobTitle').value.trim() === title &&
            document.getElementById('jobLocation').value.trim() === location;

          if (stillSameSearch && freshJobs.length) {
            renderFoundJobs(freshJobs);
            track('find_jobs_hydrated', 'jobs_search', { count: freshJobs.length });
          }
        } catch {
          // Keep instant results if hydration fails; user still gets immediate output.
        }
      }, refreshAfterMs);
    }
  } catch (err) {
    jobsListEl.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    track('find_jobs_failed', 'jobs_search', { message: err.message });
  } finally {
    clearButtonLoading(btn);
  }
});

document.getElementById('jobTitle')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('findJobsBtn')?.click();
});

document.getElementById('jobLocation')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('findJobsBtn')?.click();
});

document.getElementById('linkedinSearchBtn')?.addEventListener('click', () => {
  const title = document.getElementById('jobTitle').value.trim();
  const location = document.getElementById('jobLocation').value.trim();

  if (!title && !location) {
    showToast('Enter a job title or location first.', 'warn');
    return;
  }

  const linkedInUrl =
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}`;

  window.open(linkedInUrl, '_blank');
});

document.getElementById('googleJobsBtn')?.addEventListener('click', () => {
  const title = document.getElementById('jobTitle').value.trim();
  const location = document.getElementById('jobLocation').value.trim();

  if (!title && !location) {
    showToast('Enter a job title or location first.', 'warn');
    return;
  }

  const googleJobsUrl =
    `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location} jobs`)}`;

  window.open(googleJobsUrl, '_blank');
});

todayPrimaryBtn?.addEventListener('click', () => {
  const label = (todayPrimaryBtn.textContent || '').toLowerCase();

  if (label.includes('search')) {
    document.getElementById('jobTitle')?.focus();
    track('today_primary_clicked', 'activation', { action: 'focus_search' });
    return;
  }

  if (label.includes('1-click')) {
    document.getElementById('oneClickApplyBtn')?.click();
    track('today_primary_clicked', 'activation', { action: 'one_click_apply' });
    return;
  }

  if (label.includes('upgrade')) {
    window.upgrade('premium', premiumBtn || undefined);
    track('today_primary_clicked', 'activation', { action: 'upgrade_premium' });
    return;
  }

  document.querySelector('.tracker-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  track('today_primary_clicked', 'activation', { action: 'open_tracker' });
});

todaySecondaryBtn?.addEventListener('click', () => {
  document.getElementById('importJobText')?.focus();
  track('today_secondary_clicked', 'activation', { action: 'focus_import' });
});

document.getElementById('importJobBtn')?.addEventListener('click', async () => {
  importedJobBoxEl.innerHTML = '<div class="empty-state">Importing job...</div>';

  try {
    const data = await api('/api/jobs/import', {
      method: 'POST',
      body: JSON.stringify({
        jobText: document.getElementById('importJobText').value,
        sourceUrl: document.getElementById('importJobUrl').value
      })
    });

    importedJobBoxEl.innerHTML = '';
    importedJobBoxEl.appendChild(createImportedJobCard(data.job));
  } catch (err) {
    importedJobBoxEl.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
  }
});

document.getElementById('oneClickApplyBtn')?.addEventListener('click', async () => {
  if (!hasPlan('premium')) {
    showToast('Upgrade to Premium to unlock 1-Click Apply.', 'warn');
    track('paywall_hit', 'one_click_apply', { requiredPlan: 'premium' });
    return;
  }

  const btn = document.getElementById('oneClickApplyBtn');
  setButtonLoading(btn, 'Applying...');
  topJobsEl.innerHTML = '<div class="empty-state">Loading top jobs...</div>';
  track('one_click_apply_started', 'one_click_apply');

  try {
    const data = await api('/api/apply/one-click', {
      method: 'POST',
      body: JSON.stringify({})
    });

    topJobsEl.innerHTML = '';

    if (!data.topJobs || !data.topJobs.length) {
      topJobsEl.innerHTML = '<div class="empty-state">No jobs ready yet.</div>';
      clearButtonLoading(btn);
      return;
    }

    data.topJobs.forEach((job) => {
      topJobsEl.appendChild(createTopJobCard(job));
    });
    track('one_click_apply_success', 'one_click_apply', { count: data.topJobs.length });
  } catch (err) {
    topJobsEl.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    track('one_click_apply_failed', 'one_click_apply', { message: err.message });
  } finally {
    clearButtonLoading(btn);
  }
});

document.getElementById('generateBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    showToast('Upgrade to Pro to unlock Resume Generator.', 'warn');
    return;
  }

  const result = document.getElementById('result');
  setAILoading(result);

  try {
    const data = await api('/api/resume/generate', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('jobDescription').value,
        resume: document.getElementById('resume').value
      })
    });

    renderAIOutput(data.result || 'No result returned.', result);
  } catch (err) {
    renderAIOutput(`Error: ${err.message}`, result);
  }
});

document.getElementById('coverBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    showToast('Upgrade to Pro to unlock Cover Letter AI.', 'warn');
    return;
  }

  const result = document.getElementById('coverResult');
  setAILoading(result);

  try {
    const data = await api('/api/generate-cover-letter', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('coverJob').value,
        resume: document.getElementById('coverResume').value
      })
    });

    renderAIOutput(data.result || 'No result returned.', result);
  } catch (err) {
    renderAIOutput(`Error: ${err.message}`, result);
  }
});

document.getElementById('matchBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    showToast('Upgrade to Pro to unlock Job Match.', 'warn');
    return;
  }

  const result = document.getElementById('matchResult');
  setAILoading(result, 'Analyzing...');

  try {
    const data = await api('/api/job-match', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('matchJob').value,
        resume: document.getElementById('matchResume').value
      })
    });

    renderAIOutput(data.result || 'No result returned.', result);
  } catch (err) {
    renderAIOutput(`Error: ${err.message}`, result);
  }
});

document.getElementById('interviewPrepBtn')?.addEventListener('click', async () => {
  if (!hasPlan('premium')) {
    showToast('Upgrade to Premium to unlock Interview Prep.', 'warn');
    return;
  }

  const result = document.getElementById('interviewPrepResult');
  setAILoading(result);

  try {
    const data = await api('/api/interview-prep', {
      method: 'POST',
      body: JSON.stringify({
        role: document.getElementById('interviewRole').value,
        jobDescription: document.getElementById('interviewJobDescription').value
      })
    });

    renderAIOutput(data.result || 'No result returned.', result);
  } catch (err) {
    renderAIOutput(`Error: ${err.message}`, result);
  }
});

document.getElementById('careerCoachBtn')?.addEventListener('click', async () => {
  if (!hasPlan('elite')) {
    showToast('Upgrade to Elite to unlock Career Coach.', 'warn');
    return;
  }

  const result = document.getElementById('careerCoachResult');
  setAILoading(result);

  try {
    const data = await api('/api/career-coach', {
      method: 'POST',
      body: JSON.stringify({
        resume: document.getElementById('careerCoachResume').value,
        goals: document.getElementById('careerCoachGoals').value
      })
    });

    renderAIOutput(data.result || 'No result returned.', result);
  } catch (err) {
    renderAIOutput(`Error: ${err.message}`, result);
  }
});

async function loadReferral() {
  try {
    const data = await api('/api/referral', { method: 'GET' });
    const referralLinkInput = document.getElementById('referralLink');
    const refCountEl = document.getElementById('refCount');

    if (referralLinkInput) {
      referralLinkInput.value = `${window.location.origin}/signup.html?ref=${data.referralCode}`;
    }

    if (refCountEl) {
      refCountEl.textContent = data.referralCount || 0;
    }
  } catch (err) {
    console.error('Referral load failed:', err.message);
  }
}

window.copyReferral = async function copyReferral() {
  const input = document.getElementById('referralLink');
  if (!input) return;

  try {
    await navigator.clipboard.writeText(input.value);
    showToast('Referral link copied!');
  } catch {
    input.select();
    document.execCommand('copy');
    showToast('Referral link copied!');
  }
};

document.getElementById('copyReferralBtn')?.addEventListener('click', () => {
  copyReferral();
});

const planToPriceIdMap = {
  pro: 'price_1THMq2KtQrGDcYVPvR3OcRyN',
  premium: 'price_1THMqvKtQrGDcYVP6K605mhv',
  elite: 'price_1THMraKtQrGDcYVPytIyvklx'
};

const priceIdToPlanMap = {
  price_1THMq2KtQrGDcYVPvR3OcRyN: 'pro',
  price_1THMqvKtQrGDcYVP6K605mhv: 'premium',
  price_1THMraKtQrGDcYVPytIyvklx: 'elite'
};

window.upgrade = async function upgrade(plan, triggerBtn) {
  const btn = triggerBtn || null;
  if (btn) setButtonLoading(btn, 'Opening checkout...');
  track('upgrade_click', 'checkout', { planInput: plan });
  try {
    const raw = String(plan || '').trim();
    const isPriceId = raw.startsWith('price_');
    const normalizedPlan = isPriceId ? priceIdToPlanMap[raw] : raw.toLowerCase();
    const priceId = isPriceId ? raw : planToPriceIdMap[normalizedPlan];

    if (!normalizedPlan && !priceId) {
      showToast('Invalid upgrade selection. Please try again.', 'error');
      if (btn) clearButtonLoading(btn);
      return;
    }

    const data = await api('/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        plan: normalizedPlan,
        priceId
      })
    });

    if (data.url) {
      try { sessionStorage.setItem('rr_last_page_before_checkout', window.location.href); } catch (e) {}
      track('checkout_redirect_ready', 'checkout', { plan: normalizedPlan || 'unknown' });
      window.location.href = data.url;
    } else {
      showToast('Failed to create checkout session.', 'error');
      track('checkout_dropoff', 'checkout', { reason: 'missing_checkout_url', plan: normalizedPlan || 'unknown' });
      if (btn) clearButtonLoading(btn);
    }
  } catch (err) {
    showToast(err.message || 'Checkout failed.', 'error');
    track('checkout_dropoff', 'checkout', { reason: err.message, planInput: plan });
    if (btn) clearButtonLoading(btn);
  }
};

window.lifetime = async function lifetime(triggerBtn) {
  const btn = triggerBtn || null;
  if (btn) setButtonLoading(btn, 'Opening checkout...');
  track('upgrade_click', 'checkout', { planInput: 'lifetime' });
  try {
    const data = await api('/api/create-lifetime-checkout', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (data.url) {
      try { sessionStorage.setItem('rr_last_page_before_checkout', window.location.href); } catch (e) {}
      track('checkout_redirect_ready', 'checkout', { plan: 'lifetime' });
      window.location.href = data.url;
    } else {
      showToast('Lifetime checkout failed.', 'error');
      track('checkout_dropoff', 'checkout', { reason: 'missing_checkout_url', plan: 'lifetime' });
      if (btn) clearButtonLoading(btn);
    }
  } catch (err) {
    showToast(`Lifetime error: ${err.message}`, 'error');
    track('checkout_dropoff', 'checkout', { reason: err.message, plan: 'lifetime' });
    if (btn) clearButtonLoading(btn);
  }
};

proBtn?.addEventListener('click', () => {
  showPlanGuide('pro');
});

premiumBtn?.addEventListener('click', () => {
  showPlanGuide('premium');
});

eliteBtn?.addEventListener('click', () => {
  showPlanGuide('elite');
});

lifetimeBtn?.addEventListener('click', () => {
  showPlanGuide('lifetime');
});

planGuideJumpBtn?.addEventListener('click', () => {
  const card = document.querySelector(`[data-plan-card="${activePlanGuide}"]`);
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

advancedInsightsBtn?.addEventListener('click', () => {
  setAdvancedInsightsVisible(!advancedInsightsVisible, { persist: true });
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (typeof clearStoredToken === 'function') {
    clearStoredToken();
  } else {
    localStorage.removeItem('token');
  }
  window.location.href = 'index.html';
});

document.getElementById('billingBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('billingBtn');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  try {
    const data = await api('/api/create-portal-session', { method: 'POST' });
    if (data.url) {
      try { sessionStorage.setItem('rr_last_page_before_checkout', window.location.href); } catch (e) {}
      window.location.href = data.url;
    } else throw new Error(data.error || 'Could not open billing portal');
  } catch (err) {
    showToast(err.message || 'Failed to open billing portal', 'error');
    btn.disabled = false;
    btn.textContent = '💳 Manage Billing';
  }
});

document.getElementById('accountBtn')?.addEventListener('click', () => {
  window.location.href = 'account.html';
});

document.getElementById('analyticsBtn')?.addEventListener('click', () => {
  window.location.href = 'analytics.html';
});

renderPlanGuide('pro');
initAdvancedInsights();

async function saveRoleProfile() {
  const message = document.getElementById('roleProfileMessage');
  try {
    const skills = String(document.getElementById('rpSkills')?.value || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const data = await api('/api/role-profiles', {
      method: 'POST',
      body: JSON.stringify({
        profileName: document.getElementById('rpName')?.value || 'Primary Profile',
        targetRole: document.getElementById('rpRole')?.value || '',
        targetLocation: document.getElementById('rpLocation')?.value || 'Remote',
        salaryTarget: document.getElementById('rpSalary')?.value || '',
        coreSkills: skills
      })
    });

    if (message) {
      message.textContent = 'Role profile saved.';
    }
    track('role_profile_saved', 'personalization', {
      hasRole: Boolean(data.profile?.targetRole),
      skills: skills.length
    });
    await loadAdaptiveRecommendations();
  } catch (err) {
    if (message) message.textContent = `Failed to save profile: ${err.message}`;
  }
}

async function loadLatestRoleProfile() {
  const message = document.getElementById('roleProfileMessage');
  try {
    const data = await api('/api/role-profiles', { method: 'GET' });
    const profile = (data.profiles || [])[0];
    if (!profile) {
      if (message) message.textContent = 'No role profile yet. Save your first one.';
      return;
    }

    document.getElementById('rpName').value = profile.profileName || '';
    document.getElementById('rpRole').value = profile.targetRole || '';
    document.getElementById('rpLocation').value = profile.targetLocation || '';
    document.getElementById('rpSalary').value = profile.salaryTarget || '';
    document.getElementById('rpSkills').value = (profile.coreSkills || []).join(', ');
    if (message) message.textContent = 'Loaded latest profile.';
  } catch (err) {
    if (message) message.textContent = `Failed to load profile: ${err.message}`;
  }
}

async function loadAdaptiveRecommendations() {
  const list = document.getElementById('adaptiveList');
  const stats = document.getElementById('adaptiveStats');
  if (!list || !stats) return;

  try {
    const data = await api('/api/recommendations/adaptive', { method: 'GET' });
    const recs = data.recommendations || [];
    const s = data.stats || {};

    stats.textContent = `Pipeline: Saved ${s.saved || 0} · Ready ${s.ready || 0} · Applied ${s.applied || 0} · Interview ${s.interview || 0} · Offer ${s.offer || 0}`;

    list.innerHTML = '';
    recs.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });

    track('adaptive_recs_loaded', 'personalization', { count: recs.length });
  } catch (err) {
    stats.textContent = `Recommendations unavailable: ${err.message}`;
  }
}

async function loadOutcomeProof() {
  try {
    const data = await api('/api/outcomes/proof', { method: 'GET' });
    const mine = data.mine || {};
    const cohorts = data.cohorts || {};

    const mineEl = document.getElementById('outcomeMine');
    const cohortEl = document.getElementById('outcomeCohort');
    if (mineEl) {
      mineEl.textContent = `You (${mine.plan || 'free'}): Applied ${mine.applied || 0} · Interview ${mine.interview || 0} · Offer ${mine.offer || 0} · Interview Rate ${(Number(mine.interviewRate || 0) * 100).toFixed(1)}% · Offer Rate ${(Number(mine.offerRate || 0) * 100).toFixed(1)}%`;
    }

    const benchmark = cohorts[mine.plan || 'free'] || cohorts.free || { applied: 0, interview: 0, offer: 0 };
    const cohortInterviewRate = benchmark.applied ? benchmark.interview / benchmark.applied : 0;
    const cohortOfferRate = benchmark.interview ? benchmark.offer / benchmark.interview : 0;

    if (cohortEl) {
      cohortEl.textContent = `Cohort benchmark (${mine.plan || 'free'}): Interview ${(cohortInterviewRate * 100).toFixed(1)}% · Offer ${(cohortOfferRate * 100).toFixed(1)}%`;
    }

    const proofApplications = document.getElementById('proofApplications');
    const proofInterviewRate = document.getElementById('proofInterviewRate');
    const proofOfferRate = document.getElementById('proofOfferRate');

    if (proofApplications) {
      const totalApplied = Object.values(cohorts).reduce((sum, c) => sum + Number(c?.applied || 0), 0);
      proofApplications.textContent = totalApplied.toLocaleString();
    }

    if (proofInterviewRate) {
      const ratio = cohortInterviewRate > 0 ? (Number(mine.interviewRate || 0) / cohortInterviewRate) : 1;
      proofInterviewRate.textContent = `${ratio.toFixed(1)}x`;
    }

    if (proofOfferRate) {
      const pct = Number(mine.offerRate || 0) * 100;
      proofOfferRate.textContent = `${pct.toFixed(1)}%`;
    }
  } catch (err) {
    const mineEl = document.getElementById('outcomeMine');
    if (mineEl) mineEl.textContent = `Outcome metrics unavailable: ${err.message}`;
  }
}

document.getElementById('saveRoleProfileBtn')?.addEventListener('click', saveRoleProfile);
document.getElementById('loadRoleProfileBtn')?.addEventListener('click', loadLatestRoleProfile);
document.getElementById('refreshAdaptiveBtn')?.addEventListener('click', loadAdaptiveRecommendations);
document.getElementById('refreshOutcomeBtn')?.addEventListener('click', loadOutcomeProof);

document.querySelectorAll('[data-plan-card]').forEach((card) => {
  card.addEventListener('click', () => {
    track('pricing_card_engaged', 'checkout', { plan: card.dataset.planCard || '' });
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;

  const jobDraft = (document.getElementById('jobTitle')?.value || '').trim();
  const iaDraft = (document.getElementById('iaQuestion')?.value || '').trim();

  if (jobDraft && !lastFoundJobs.length) {
    track('dropoff_job_search_draft', 'jobs_search', { chars: jobDraft.length });
  }

  if (iaDraft) {
    track('dropoff_ia_draft', 'interview_assist', { chars: iaDraft.length });
  }
});

// ─── Interview Assist Mode ────────────────────────────────────────────────────
(function () {
  const iaHistory = [];    // session history: [{question, type, answer, bullets, tip}]
  let iaContext = { role: '', resume: '' };

  const setupToggleBtn  = document.getElementById('iaSetupToggle');
  const setupPanel      = document.getElementById('iaSetupPanel');
  const iaSaveCtxBtn    = document.getElementById('iaSaveContext');
  const iaContextSaved  = document.getElementById('iaContextSaved');
  const iaRoleInput     = document.getElementById('iaRole');
  const iaResumeInput   = document.getElementById('iaResume');
  const iaQuestionInput = document.getElementById('iaQuestion');
  const iaSubmitBtn     = document.getElementById('iaSubmitBtn');
  const iaResponse      = document.getElementById('iaResponse');
  const iaTypeBadge     = document.getElementById('iaTypeBadge');
  const iaAnswer        = document.getElementById('iaAnswer');
  const iaBullets       = document.getElementById('iaBullets');
  const iaTip           = document.getElementById('iaTip');
  const iaCopyBtn       = document.getElementById('iaCopyBtn');
  const iaHistoryEl     = document.getElementById('iaHistory');
  const iaHistoryList   = document.getElementById('iaHistoryList');

  if (!iaSubmitBtn) return; // card not present or not unlocked yet

  track('ia_module_viewed', 'interview_assist', { unlocked: hasPlan('elite') });

  setupToggleBtn?.addEventListener('click', () => {
    const open = setupPanel.style.display !== 'none';
    setupPanel.style.display = open ? 'none' : 'block';
    setupToggleBtn.textContent = open ? '⚙️ Set Context (Role + Resume)' : '⚙️ Hide Context';
  });

  iaSaveCtxBtn?.addEventListener('click', () => {
    iaContext.role   = (iaRoleInput?.value   || '').trim();
    iaContext.resume = (iaResumeInput?.value || '').trim();
    track('ia_context_saved', 'interview_assist', {
      hasRole: Boolean(iaContext.role),
      hasResume: Boolean(iaContext.resume)
    });
    if (iaContextSaved) {
      iaContextSaved.style.display = 'inline';
      setTimeout(() => { iaContextSaved.style.display = 'none'; }, 2000);
    }
  });

  // Submit on Ctrl+Enter / Cmd+Enter inside textarea
  iaQuestionInput?.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      iaSubmitBtn.click();
    }
  });

  iaSubmitBtn?.addEventListener('click', async () => {
    const question = (iaQuestionInput?.value || '').trim();
    if (!question) return;

    setButtonLoading(iaSubmitBtn, 'Thinking…');
    iaResponse.style.display = 'none';
    track('ia_question_submitted', 'interview_assist', { length: question.length });

    try {
      const payload = {
        question,
        role:    iaContext.role   || undefined,
        resume:  iaContext.resume || undefined,
        history: iaHistory.slice(-4).map(h => ({ question: h.question, answer: h.answer }))
      };

      const data = await api('/api/interview-assist', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Render response
      const typeLabel = data.type || 'general';
      iaTypeBadge.textContent = typeLabel;
      iaTypeBadge.className = `ia-type-badge ia-type-${typeLabel}`;
      iaAnswer.textContent = data.answer || '';

      iaBullets.innerHTML = '';
      if (Array.isArray(data.bullets) && data.bullets.length) {
        data.bullets.forEach(b => {
          const el = document.createElement('div');
          el.className = 'ia-bullet';
          el.textContent = `· ${b}`;
          iaBullets.appendChild(el);
        });
      }

      iaTip.textContent = data.tip ? `💡 ${data.tip}` : '';
      iaTip.style.display = data.tip ? 'block' : 'none';

      iaResponse.style.display = 'block';
      track('ia_answer_generated', 'interview_assist', {
        type: typeLabel,
        bullets: Array.isArray(data.bullets) ? data.bullets.length : 0
      });

      // Add to session history
      iaHistory.push({ question, type: typeLabel, answer: data.answer || '', bullets: data.bullets || [], tip: data.tip || '' });
      renderHistory();

      iaQuestionInput.value = '';
      iaQuestionInput.focus();
    } catch (err) {
      showToast(err.message || 'Interview Assist failed', 'error');
      track('ia_dropoff', 'interview_assist', { reason: err.message || 'unknown' });
    } finally {
      clearButtonLoading(iaSubmitBtn);
    }
  });

  iaCopyBtn?.addEventListener('click', () => {
    const text = iaAnswer?.textContent || '';
    navigator.clipboard?.writeText(text).then(() => {
      track('ia_answer_copied', 'interview_assist', { chars: text.length });
      iaCopyBtn.textContent = 'Copied ✓';
      setTimeout(() => { iaCopyBtn.textContent = 'Copy'; }, 2000);
    });
  });

  function renderHistory() {
    if (!iaHistoryList || !iaHistoryEl) return;
    iaHistoryEl.style.display = iaHistory.length ? 'block' : 'none';
    iaHistoryList.innerHTML = iaHistory.slice().reverse().map((h, i) => `
      <div class="ia-history-item">
        <div class="ia-history-q">Q${iaHistory.length - i}: ${escapeHtml(h.question)}</div>
        <div class="ia-history-a">${escapeHtml(h.answer)}</div>
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
})();

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === '1') {
    e.preventDefault();
    document.getElementById('jobTitle')?.focus();
  }

  if (e.altKey && e.key === '2') {
    e.preventDefault();
    document.getElementById('iaQuestion')?.focus();
  }

  if (!e.ctrlKey && !e.metaKey && e.key === '/') {
    const activeTag = (document.activeElement?.tagName || '').toLowerCase();
    if (!['input', 'textarea', 'select'].includes(activeTag)) {
      e.preventDefault();
      document.getElementById('jobTitle')?.focus();
    }
  }
});

let pipelineChartInstance = null;

function renderPipelineChart() {
  const canvas = document.getElementById('pipelineChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const stats = latestTrackerStats || { saved: 0, ready: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };

  const data = {
    labels: ['Saved', 'Ready', 'Applied', 'Interview', 'Offer', 'Rejected'],
    datasets: [
      {
        data: [
          stats.saved || 0,
          stats.ready || 0,
          stats.applied || 0,
          stats.interview || 0,
          stats.offer || 0,
          stats.rejected || 0
        ],
        backgroundColor: [
          '#e0f2fe',
          '#0ea5e9',
          '#0284c7',
          '#0369a1',
          '#059669',
          '#dc2626'
        ],
        borderColor: [
          '#bae6fd',
          '#38bdf8',
          '#0369a1',
          '#0c4a6e',
          '#047857',
          '#b91c1c'
        ],
        borderWidth: 2
      }
    ]
  };

  if (pipelineChartInstance) {
    pipelineChartInstance.data = data;
    pipelineChartInstance.update();
  } else {
    pipelineChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 12, weight: '600', family: '"Plus Jakarta Sans", "Segoe UI", sans-serif' },
              color: '#475569',
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12,
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            titleFont: { size: 13, weight: '700' },
            bodyFont: { size: 12 },
            displayColors: true
          }
        }
      }
    });
  }

  // Update KPI stats
  const kpiSavedEl = document.getElementById('kpiSaved');
  const kpiAppliedEl = document.getElementById('kpiApplied');
  const kpiInterviewEl = document.getElementById('kpiInterview');
  const kpiOfferEl = document.getElementById('kpiOffer');

  if (kpiSavedEl) kpiSavedEl.textContent = String(stats.saved || 0);
  if (kpiAppliedEl) kpiAppliedEl.textContent = String(stats.applied || 0);
  if (kpiInterviewEl) kpiInterviewEl.textContent = String(stats.interview || 0);
  if (kpiOfferEl) kpiOfferEl.textContent = String(stats.offer || 0);
}

async function loadTracker() {
  if (!savedJobsEl || !readyJobsEl || !appliedJobsEl || !interviewJobsEl || !offerJobsEl || !rejectedJobsEl) {
    return;
  }

  savedJobsEl.innerHTML = '';
  readyJobsEl.innerHTML = '';
  appliedJobsEl.innerHTML = '';
  interviewJobsEl.innerHTML = '';
  offerJobsEl.innerHTML = '';
  rejectedJobsEl.innerHTML = '';

  try {
    const data = await api('/api/jobs', { method: 'GET' });
    const jobs = data.jobs || [];

    const buckets = {
      saved: [],
      ready: [],
      applied: [],
      interview: [],
      offer: [],
      rejected: []
    };

    jobs.forEach((job) => {
      const status = (job.status || 'saved').toLowerCase();
      if (buckets[status]) {
        buckets[status].push(job);
      } else {
        buckets.saved.push(job);
      }
    });

    const fill = (el, arr) => {
      if (!arr.length) {
        el.innerHTML = '<div class="empty-state">No jobs here.</div>';
        return;
      }

      arr.forEach((job) => {
        el.appendChild(createTrackerCard(job));
      });
    };

    fill(savedJobsEl, buckets.saved);
    fill(readyJobsEl, buckets.ready);
    fill(appliedJobsEl, buckets.applied);
    fill(interviewJobsEl, buckets.interview);
    fill(offerJobsEl, buckets.offer);
    fill(rejectedJobsEl, buckets.rejected);

    latestTrackerStats = {
      total: jobs.length,
      saved: buckets.saved.length,
      ready: buckets.ready.length,
      applied: buckets.applied.length,
      interview: buckets.interview.length,
      offer: buckets.offer.length,
      rejected: buckets.rejected.length
    };

    updateTodayRail();
    renderPipelineChart();
  } catch (err) {
    const message = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    savedJobsEl.innerHTML = message;
    readyJobsEl.innerHTML = message;
    appliedJobsEl.innerHTML = message;
    interviewJobsEl.innerHTML = message;
    offerJobsEl.innerHTML = message;
    rejectedJobsEl.innerHTML = message;
  }
}

async function loadModeImpactKpis() {
  if (!modeKpiSummaryEl || !modeKpiSessionsEl || !modeKpiStarterEl || !modeKpiPowerEl) return;

  try {
    const data = await api('/api/dashboard/mode-kpis?days=14', { method: 'GET' }, { retries: 0, timeoutMs: 7000 });

    const sessions = Number(data?.totals?.sessions || 0);
    const starter = data?.byMode?.starter || {};
    const power = data?.byMode?.power || {};

    const starterSearchRate = sessions
      ? Math.min(100, Math.round((Number(starter.searches || 0) / sessions) * 100))
      : 0;

    const powerIntentBase = Number(power.searches || 0) || 1;
    const powerIntentRate = Math.min(
      100,
      Math.round(((Number(power.oneClickRuns || 0) + Number(power.upgradeClicks || 0)) / powerIntentBase) * 100)
    );

    modeKpiSummaryEl.textContent =
      `Starter searches: ${starter.searches || 0} · Power high-intent actions: ${(Number(power.oneClickRuns || 0) + Number(power.upgradeClicks || 0))}`;
    modeKpiSessionsEl.textContent = String(sessions);
    modeKpiStarterEl.textContent = `${starterSearchRate}%`;
    modeKpiPowerEl.textContent = `${powerIntentRate}%`;
  } catch (err) {
    modeKpiSummaryEl.textContent = `KPI snapshot unavailable: ${err.message}`;
  }
}

function scheduleHeavyLoads() {
  const run = () => {
    loadReferral();
    loadModeImpactKpis();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 300);
  }

  const trackerWrap = document.querySelector('.tracker-wrap');
  if (!trackerWrap) return;

  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadTracker();
      track('tracker_lazy_loaded', 'performance');
      observer.disconnect();
    }
  }, { rootMargin: '200px' });

  observer.observe(trackerWrap);
}

initPricingExperiment();
updateTodayRail();
loadUserPlan().finally(() => {
  initDashboardMode();
  handleCheckoutRedirectState();
});
initSavedResumeManager();
initMobileSidebar();
loadSavedResume();
updateDynamicCoachInsights();
scheduleHeavyLoads();
syncLifetimeOfferUi();
loadLatestRoleProfile();
loadAdaptiveRecommendations();
loadOutcomeProof();

// ─── Global loading state helpers ─────────────────────────────────────────
function setButtonLoading(btn, text = 'Loading...') {
  btn.disabled = true;
  btn._origText = btn.textContent;
  btn.textContent = text;
}
function clearButtonLoading(btn) {
  btn.disabled = false;
  btn.textContent = btn._origText || btn.textContent;
}