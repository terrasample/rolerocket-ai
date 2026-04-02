const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

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

const sessionId = (() => {
  const existing = localStorage.getItem('rr_dashboard_sid');
  if (existing) return existing;
  const next = `sid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem('rr_dashboard_sid', next);
  return next;
})();

const telemetryQueue = [];

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
    return await fetch(path, { ...options, signal: controller.signal });
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
    meta
  });
}

async function flushTelemetry() {
  if (!telemetryQueue.length || !navigator.onLine) return;

  const batch = telemetryQueue.splice(0, 15);

  await Promise.allSettled(
    batch.map((evt) =>
      fetch('/api/telemetry', {
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
    if (proSubtext) proSubtext.textContent = 'Tailor resume + cover letter in minutes, not hours.';
    if (premiumSubtext) premiumSubtext.textContent = 'Turn top matches into interviews with ATS + 1-Click flow.';
    if (eliteSubtext) eliteSubtext.textContent = 'Live interview assist and strategic coaching for high-stakes roles.';
    if (proCta) proCta.textContent = 'Start Pro Now';
    if (premiumCta) premiumCta.textContent = 'Unlock Premium Tools';
    if (eliteCta) eliteCta.textContent = 'Activate Elite Coach';
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
      planBadgeEl.textContent = formatPlan(currentUserPlan);
      applyLocks();
      track('user_plan_loaded', 'activation', { plan: currentUserPlan });
    }
  } catch {
    currentUserPlan = 'free';
    planBadgeEl.textContent = 'Free Plan';
    applyLocks();
  }
}

function encodeJob(job) {
  return encodeURIComponent(JSON.stringify(job));
}

function createSearchJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card';

  const safeJob = encodeJob(job);

  wrapper.innerHTML = `
    <strong>${job.title || 'Untitled Job'}</strong><br>
    <span>${job.company || 'Unknown Company'}</span><br>
    <small>📍 ${job.location || 'Unknown Location'}</small><br>
    <small>🔥 Match: ${job.matchScore || 0}%</small><br>
    <small>Source: ${job.source || 'Imported'}</small><br><br>

    <div class="job-card-actions">
      <a href="${job.link || '#'}" target="_blank">View Job</a>
      <button onclick="saveFoundJob('${safeJob}')">Save Job</button>
      <button onclick="sendJobToOneClick('${safeJob}')">Send to 1-Click Apply</button>
      <a href="${job.linkedinSearchUrl || '#'}" target="_blank">Search LinkedIn</a>
    </div>
  `;

  return wrapper;
}

function createImportedJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card';

  const safeJob = encodeJob(job);

  wrapper.innerHTML = `
    <strong>${job.title || 'Imported Role'}</strong><br>
    <span>${job.company || 'Imported Company'}</span><br>
    <small>📍 ${job.location || 'Remote'}</small><br>
    <small>🔥 Match: ${job.matchScore || 0}%</small><br>
    <small>Source: ${job.source || 'Imported Job'}</small><br><br>

    <div class="job-card-actions">
      <a href="${job.link || '#'}" target="_blank">Open Original Job</a>
      <button onclick="saveFoundJob('${safeJob}')">Save Job</button>
      <button onclick="sendJobToOneClick('${safeJob}')">Send to 1-Click Apply</button>
      <a href="${job.linkedinSearchUrl || '#'}" target="_blank">Search LinkedIn</a>
    </div>
  `;

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

  wrapper.innerHTML = `
    <strong>${job.title || 'Untitled Job'}</strong><br>
    <span>${job.company || 'Unknown Company'}</span><br>
    <small>⚡ Urgency: ${job.urgencyLabel || 'Unknown'}</small><br>
    <small>🔥 Match: ${job.matchScore || 0}%</small>
  `;

  return wrapper;
}

function createTrackerCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card tracker-job-card';

  const currentStatus = (job.status || 'saved').toLowerCase();

  wrapper.innerHTML = `
    <strong>${job.title || 'Untitled Job'}</strong><br>
    <span>${job.company || 'Unknown Company'}</span><br>
    <small>${job.location || ''}</small><br><br>

    <div class="tracker-actions">
      <select onchange="updateJobStatus('${job._id}', this.value)">
        <option value="saved" ${currentStatus === 'saved' ? 'selected' : ''}>Saved</option>
        <option value="ready" ${currentStatus === 'ready' ? 'selected' : ''}>Ready</option>
        <option value="applied" ${currentStatus === 'applied' ? 'selected' : ''}>Applied</option>
        <option value="interview" ${currentStatus === 'interview' ? 'selected' : ''}>Interview</option>
        <option value="offer" ${currentStatus === 'offer' ? 'selected' : ''}>Offer</option>
        <option value="rejected" ${currentStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
      </select>
    </div>
  `;

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
    alert('✅ Job saved to tracker');
    await loadTracker();
  } catch (err) {
    alert(`Save error: ${err.message}`);
  }
};

window.sendJobToOneClick = async function sendJobToOneClick(encodedJob) {
  if (!hasPlan('premium')) {
    alert('Unlock job-winning resumes and faster offers with Premium.');
    return;
  }

  try {
    const job = JSON.parse(decodeURIComponent(encodedJob));
    await saveJobToBackend(job, 'ready');
    alert('⚡ Job sent to Ready for 1-Click Apply');
    await loadTracker();
  } catch (err) {
    alert(`1-Click Apply save error: ${err.message}`);
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
    alert(`Status update error: ${err.message}`);
  }
};

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
  setButtonLoading(btn, 'Finding...');
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
    jobsListEl.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
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
    alert('Enter a job title or location first.');
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
    alert('Enter a job title or location first.');
    return;
  }

  const googleJobsUrl =
    `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location} jobs`)}`;

  window.open(googleJobsUrl, '_blank');
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
    importedJobBoxEl.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
});

document.getElementById('oneClickApplyBtn')?.addEventListener('click', async () => {
  if (!hasPlan('premium')) {
    alert('Unlock job-winning resumes and faster offers with Premium.');
    track('paywall_hit', 'one_click_apply', { requiredPlan: 'premium' });
    return;
  }

  const btn = document.getElementById('oneClickApplyBtn');
  setButtonLoading(btn, 'Running...');
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
    topJobsEl.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
    track('one_click_apply_failed', 'one_click_apply', { message: err.message });
  } finally {
    clearButtonLoading(btn);
  }
});

document.getElementById('generateBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    alert('Unlock job-winning resumes and faster offers with Pro.');
    return;
  }

  const result = document.getElementById('result');
  result.textContent = 'Generating...';

  try {
    const data = await api('/api/resume/generate', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('jobDescription').value,
        resume: document.getElementById('resume').value
      })
    });

    result.textContent = data.result || 'No result returned.';
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('coverBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    alert('Unlock job-winning resumes and faster offers with Pro.');
    return;
  }

  const result = document.getElementById('coverResult');
  result.textContent = 'Generating...';

  try {
    const data = await api('/api/generate-cover-letter', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('coverJob').value,
        resume: document.getElementById('coverResume').value
      })
    });

    result.textContent = data.result || 'No result returned.';
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('matchBtn')?.addEventListener('click', async () => {
  if (!hasPlan('pro')) {
    alert('Unlock job-winning resumes and faster offers with Pro.');
    return;
  }

  const result = document.getElementById('matchResult');
  result.textContent = 'Analyzing...';

  try {
    const data = await api('/api/job-match', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription: document.getElementById('matchJob').value,
        resume: document.getElementById('matchResume').value
      })
    });

    result.textContent = data.result || 'No result returned.';
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('interviewPrepBtn')?.addEventListener('click', async () => {
  if (!hasPlan('premium')) {
    alert('Unlock interview prep and stronger offer positioning with Premium.');
    return;
  }

  const result = document.getElementById('interviewPrepResult');
  result.textContent = 'Generating...';

  try {
    const data = await api('/api/interview-prep', {
      method: 'POST',
      body: JSON.stringify({
        role: document.getElementById('interviewRole').value,
        jobDescription: document.getElementById('interviewJobDescription').value
      })
    });

    result.textContent = data.result || 'No result returned.';
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('careerCoachBtn')?.addEventListener('click', async () => {
  if (!hasPlan('elite')) {
    alert('Unlock deeper career strategy and premium guidance with Elite.');
    return;
  }

  const result = document.getElementById('careerCoachResult');
  result.textContent = 'Generating...';

  try {
    const data = await api('/api/career-coach', {
      method: 'POST',
      body: JSON.stringify({
        resume: document.getElementById('careerCoachResume').value,
        goals: document.getElementById('careerCoachGoals').value
      })
    });

    result.textContent = data.result || 'No result returned.';
  } catch (err) {
    result.textContent = `Error: ${err.message}`;
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
    alert('Referral link copied!');
  } catch {
    input.select();
    document.execCommand('copy');
    alert('Referral link copied!');
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
  if (btn) setButtonLoading(btn, 'Redirecting...');
  track('upgrade_click', 'checkout', { planInput: plan });
  try {
    const raw = String(plan || '').trim();
    const isPriceId = raw.startsWith('price_');
    const normalizedPlan = isPriceId ? priceIdToPlanMap[raw] : raw.toLowerCase();
    const priceId = isPriceId ? raw : planToPriceIdMap[normalizedPlan];

    if (!normalizedPlan && !priceId) {
      alert('Invalid upgrade selection. Please try again.');
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
      track('checkout_redirect_ready', 'checkout', { plan: normalizedPlan || 'unknown' });
      window.location.href = data.url;
    } else {
      alert('Failed to create checkout session');
      track('checkout_dropoff', 'checkout', { reason: 'missing_checkout_url', plan: normalizedPlan || 'unknown' });
      if (btn) clearButtonLoading(btn);
    }
  } catch (err) {
    alert(err.message);
    track('checkout_dropoff', 'checkout', { reason: err.message, planInput: plan });
    if (btn) clearButtonLoading(btn);
  }
};

window.lifetime = async function lifetime(triggerBtn) {
  const btn = triggerBtn || null;
  if (btn) setButtonLoading(btn, 'Redirecting...');
  track('upgrade_click', 'checkout', { planInput: 'lifetime' });
  try {
    const data = await api('/api/create-lifetime-checkout', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (data.url) {
      track('checkout_redirect_ready', 'checkout', { plan: 'lifetime' });
      window.location.href = data.url;
    } else {
      alert('Lifetime checkout failed');
      track('checkout_dropoff', 'checkout', { reason: 'missing_checkout_url', plan: 'lifetime' });
      if (btn) clearButtonLoading(btn);
    }
  } catch (err) {
    alert(`Lifetime error: ${err.message}`);
    track('checkout_dropoff', 'checkout', { reason: err.message, plan: 'lifetime' });
    if (btn) clearButtonLoading(btn);
  }
};

proBtn?.addEventListener('click', (e) => {
  upgrade('pro', e.currentTarget);
});

premiumBtn?.addEventListener('click', (e) => {
  upgrade('premium', e.currentTarget);
});

eliteBtn?.addEventListener('click', (e) => {
  upgrade('elite', e.currentTarget);
});

lifetimeBtn?.addEventListener('click', (e) => {
  lifetime(e.currentTarget);
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
});

document.getElementById('billingBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('billingBtn');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  try {
    const data = await api('/api/create-portal-session', { method: 'POST' });
    if (data.url) window.location.href = data.url;
    else throw new Error(data.error || 'Could not open billing portal');
  } catch (err) {
    alert(err.message || 'Failed to open billing portal');
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
      alert(err.message || 'Interview Assist failed');
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
  } catch (err) {
    const message = `<div class="empty-state">❌ ${err.message}</div>`;
    savedJobsEl.innerHTML = message;
    readyJobsEl.innerHTML = message;
    appliedJobsEl.innerHTML = message;
    interviewJobsEl.innerHTML = message;
    offerJobsEl.innerHTML = message;
    rejectedJobsEl.innerHTML = message;
  }
}

function scheduleHeavyLoads() {
  const run = () => {
    loadReferral();
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
loadUserPlan();
updateDynamicCoachInsights();
scheduleHeavyLoads();
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