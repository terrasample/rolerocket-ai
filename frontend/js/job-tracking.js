const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

const jobsListEl = document.getElementById('jobsList');
const importedJobBoxEl = document.getElementById('importedJobBox');

const savedJobsEl = document.getElementById('savedJobs');
const readyJobsEl = document.getElementById('readyJobs');
const appliedJobsEl = document.getElementById('appliedJobs');
const interviewJobsEl = document.getElementById('interviewJobs');
const offerJobsEl = document.getElementById('offerJobs');
const rejectedJobsEl = document.getElementById('rejectedJobs');

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
  } catch {
    // ignore invalid url
  }
  return '#';
}

async function api(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(apiUrl(path), { ...options, headers });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }

  return payload;
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

  const actions = document.createElement('div');
  actions.className = 'job-card-actions';

  const viewLink = document.createElement('a');
  viewLink.href = safeUrl(job.link);
  viewLink.target = '_blank';
  viewLink.rel = 'noopener noreferrer';
  viewLink.textContent = 'Open Job';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Job';
  saveBtn.addEventListener('click', async () => {
    try {
      await saveJobToBackend(job, 'saved');
      await loadTracker();
    } catch (err) {
      alert(err.message);
    }
  });

  const readyBtn = document.createElement('button');
  readyBtn.className = 'secondary-btn';
  readyBtn.textContent = 'Send to Ready';
  readyBtn.addEventListener('click', async () => {
    try {
      await saveJobToBackend(job, 'ready');
      await loadTracker();
    } catch (err) {
      alert(err.message);
    }
  });

  actions.append(viewLink, saveBtn, readyBtn);
  wrapper.append(titleEl, document.createElement('br'), companyEl, document.createElement('br'), locationEl, document.createElement('br'), matchEl, document.createElement('br'), actions);

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

  const actions = document.createElement('div');
  actions.className = 'job-card-actions';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Job';
  saveBtn.addEventListener('click', async () => {
    try {
      await saveJobToBackend(job, 'saved');
      await loadTracker();
    } catch (err) {
      alert(err.message);
    }
  });

  actions.append(saveBtn);
  wrapper.append(titleEl, document.createElement('br'), companyEl, document.createElement('br'), locationEl, document.createElement('br'), actions);

  return wrapper;
}

function createTrackerCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card tracker-job-card';

  const currentStatus = String(job.status || 'saved').toLowerCase();

  const titleEl = document.createElement('strong');
  titleEl.textContent = job.title || 'Untitled Job';

  const companyEl = document.createElement('span');
  companyEl.textContent = job.company || 'Unknown Company';

  const locationEl = document.createElement('small');
  locationEl.textContent = job.location || 'Location not provided';

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

  select.addEventListener('change', async () => {
    try {
      await api(`/api/jobs/${job._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: select.value })
      });
      await loadTracker();
    } catch (err) {
      alert(err.message);
    }
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-job-btn';
  removeBtn.textContent = 'Remove Job';
  removeBtn.addEventListener('click', async () => {
    try {
      await api(`/api/jobs/${job._id}`, { method: 'DELETE' });
      await loadTracker();
    } catch (err) {
      alert(err.message);
    }
  });

  actionsDiv.append(select, removeBtn);
  wrapper.append(titleEl, document.createElement('br'), companyEl, document.createElement('br'), locationEl, document.createElement('br'), actionsDiv);

  return wrapper;
}

async function saveJobToBackend(job, status) {
  const payload = {
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    link: job.link || '',
    description: job.description || '',
    matchScore: Number(job.matchScore || 0),
    source: job.source || 'Imported',
    status
  };

  return api('/api/jobs/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function loadTracker() {
  const columns = [savedJobsEl, readyJobsEl, appliedJobsEl, interviewJobsEl, offerJobsEl, rejectedJobsEl];
  columns.forEach((el) => {
    el.innerHTML = '';
  });

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
      const status = String(job.status || 'saved').toLowerCase();
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
    const message = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
    columns.forEach((el) => {
      el.innerHTML = message;
    });
  }
}

document.getElementById('findJobsBtn')?.addEventListener('click', async () => {
  jobsListEl.innerHTML = '<div class="empty-state">Loading jobs...</div>';

  try {
    const data = await api('/api/jobs/find', {
      method: 'POST',
      body: JSON.stringify({
        title: document.getElementById('jobTitle').value.trim(),
        location: document.getElementById('jobLocation').value.trim(),
        resume: document.getElementById('jobResume').value
      })
    });

    const jobs = data.jobs || [];
    jobsListEl.innerHTML = '';

    if (!jobs.length) {
      jobsListEl.innerHTML = '<div class="empty-state">No jobs found.</div>';
      return;
    }

    jobs.forEach((job) => {
      jobsListEl.appendChild(createSearchJobCard(job));
    });
  } catch (err) {
    jobsListEl.innerHTML = `<div class="empty-state">❌ ${escapeHtml(err.message)}</div>`;
  }
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

document.getElementById('linkedinSearchBtn')?.addEventListener('click', () => {
  const title = document.getElementById('jobTitle').value.trim();
  const location = document.getElementById('jobLocation').value.trim();
  const linkedInUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}`;
  window.open(linkedInUrl, '_blank');
});

document.getElementById('googleJobsBtn')?.addEventListener('click', () => {
  const title = document.getElementById('jobTitle').value.trim();
  const location = document.getElementById('jobLocation').value.trim();
  const googleJobsUrl = `https://www.google.com/search?q=${encodeURIComponent(`${title} ${location} jobs`)}`;
  window.open(googleJobsUrl, '_blank');
});

loadTracker();
