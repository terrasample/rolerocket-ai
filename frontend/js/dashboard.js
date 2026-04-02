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

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const res = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  const text = await res.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
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

async function loadUserPlan() {
  try {
    const data = await api('/api/me', { method: 'GET' });

    if (data.user) {
      currentUserPlan = normalizePlan(data.user.plan || 'free');
      planBadgeEl.textContent = formatPlan(currentUserPlan);
      applyLocks();
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
  jobsListEl.innerHTML = '<div class="empty-state">Loading jobs...</div>';

  try {
    const title = document.getElementById('jobTitle').value.trim();
    const location = document.getElementById('jobLocation').value.trim();

    const data = await api('/api/jobs/find', {
      method: 'POST',
      body: JSON.stringify({
        title,
        location,
        resume: document.getElementById('jobResume').value
      })
    });

    jobsListEl.innerHTML = '';
    lastFoundJobs = data.jobs || [];
    updateDynamicCoachInsights();

    if (!data.jobs || !data.jobs.length) {
      jobsListEl.innerHTML = '<div class="empty-state">No jobs found.</div>';
      return;
    }

    data.jobs.forEach((job) => {
      jobsListEl.appendChild(createSearchJobCard(job));
    });
  } catch (err) {
    jobsListEl.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
  }
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
    return;
  }

  topJobsEl.innerHTML = '<div class="empty-state">Loading top jobs...</div>';

  try {
    const data = await api('/api/apply/one-click', {
      method: 'POST',
      body: JSON.stringify({})
    });

    topJobsEl.innerHTML = '';

    if (!data.topJobs || !data.topJobs.length) {
      topJobsEl.innerHTML = '<div class="empty-state">No jobs ready yet.</div>';
      return;
    }

    data.topJobs.forEach((job) => {
      topJobsEl.appendChild(createTopJobCard(job));
    });
  } catch (err) {
    topJobsEl.innerHTML = `<div class="empty-state">❌ ${err.message}</div>`;
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

window.upgrade = async function upgrade(plan) {
  try {
    const data = await api('/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ plan })
    });

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Failed to create checkout session');
    }
  } catch (err) {
    alert(err.message);
  }
};

window.lifetime = async function lifetime() {
  try {
    const data = await api('/api/create-lifetime-checkout', {
      method: 'POST',
      body: JSON.stringify({})
    });

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Lifetime checkout failed');
    }
  } catch (err) {
    alert(`Lifetime error: ${err.message}`);
  }
};

proBtn?.addEventListener('click', () => {
  upgrade('pro');
});

premiumBtn?.addEventListener('click', () => {
  upgrade('premium');
});

eliteBtn?.addEventListener('click', () => {
  upgrade('elite');
});

lifetimeBtn?.addEventListener('click', () => {
  lifetime();
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
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

loadUserPlan();
updateDynamicCoachInsights();
loadTracker();
loadReferral();