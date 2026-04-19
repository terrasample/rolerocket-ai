(function() {
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

function isPlaceholderHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'example.com' || host === 'www.example.com' || host === 'example.org' || host === 'www.example.org';
  } catch {
    return true;
  }
}

function buildFallbackJobSearchUrl(job) {
  const query = [job.title, job.company, job.location, 'job'].filter(Boolean).join(' ').trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query || 'project manager jobs')}`;
}

function resolveJobUrl(job) {
  const candidate = safeUrl(job.link);
  if (candidate !== '#' && !isPlaceholderHost(candidate)) {
    return { href: candidate, label: 'Open Job' };
  }

  if (job.linkedinSearchUrl && safeUrl(job.linkedinSearchUrl) !== '#') {
    return { href: safeUrl(job.linkedinSearchUrl), label: 'Find Job Source' };
  }

  return { href: buildFallbackJobSearchUrl(job), label: 'Find Job Source' };
}

function compactJobText(value, fallback, maxLen) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;

  const markerRegex = /(skip to main content|this button displays|jobs people learning|clear text|join or sign in)/i;
  const markerMatch = text.match(markerRegex);
  let cleaned = markerMatch && markerMatch.index > 20 ? text.slice(0, markerMatch.index).trim() : text;

  if (cleaned.length > maxLen) {
    const clipped = cleaned.slice(0, maxLen);
    cleaned = clipped.replace(/\s+\S*$/, '').trim() + '...';
  }

  return cleaned || fallback;
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

  const ageEl = document.createElement('small');
  if (job.postedAgo) {
    ageEl.textContent = `🕒 Posted: ${job.postedAgo}`;
  } else if (job.postedAt) {
    // fallback: show date
    ageEl.textContent = `🕒 Posted: ${new Date(job.postedAt).toLocaleDateString()}`;
  }

  const actions = document.createElement('div');
  actions.className = 'job-card-actions';

  const viewLink = document.createElement('a');
  const resolved = resolveJobUrl(job);
  viewLink.href = resolved.href;
  viewLink.target = '_blank';
  viewLink.rel = 'noopener noreferrer';
  viewLink.textContent = resolved.label;

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
  wrapper.append(titleEl, document.createElement('br'), companyEl, document.createElement('br'), locationEl, document.createElement('br'), matchEl, document.createElement('br'), ageEl, document.createElement('br'), actions);
// Import Resume logic
document.getElementById('importResumeBtn')?.addEventListener('click', () => {
  document.getElementById('importResumeFile').click();
});

document.getElementById('importResumeFile')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
  if (!file) return;
  const textarea = document.getElementById('jobResume');
  textarea.value = 'Parsing resume...';
  const formData = new FormData();
  formData.append('resumeFile', file);
  try {
    const res = await fetch('/api/resume/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok && data.content) {
      textarea.value = data.content;
    } else {
      textarea.value = '';
      alert(data.error || 'Could not extract text from resume.');
    }
  } catch (err) {
    textarea.value = '';
    alert('Resume upload failed.');
  }
});

// Export Resume logic (PDF)
document.getElementById('exportResumeBtn')?.addEventListener('click', () => {
  const text = document.getElementById('jobResume').value;
  if (!text) {
    alert('No resume to export.');
    return;
  }
  // Use jsPDF for PDF export
  if (window.jsPDF) {
    const doc = new window.jsPDF();
    doc.text(text, 10, 10);
    doc.save('resume.pdf');
  } else {
    alert('PDF export requires jsPDF.');
  }
});

// Show export button after jobs are populated
const observer = new MutationObserver(() => {
  const exportBtn = document.getElementById('exportResumeBtn');
  if (jobsListEl && jobsListEl.children.length > 0) {
    exportBtn.style.display = '';
  } else {
    exportBtn.style.display = 'none';
  }
});
observer.observe(jobsListEl, { childList: true });

  return wrapper;
}

function createImportedJobCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'imported-job-card';
  wrapper.style.cssText = `
    background: #f8fafc;
    border: 2px solid #0ea5e9;
    border-radius: 12px;
    padding: 20px;
    margin-top: 16px;
    max-height: 600px;
    overflow-y: auto;
  `;

  // Job Title
  const titleEl = document.createElement('h3');
  titleEl.textContent = compactJobText(job.title, 'Imported Role', 95);
  titleEl.style.cssText = 'margin: 0 0 8px 0; color: #0ea5e9; font-size: 1.3em;';

  // Company
  const companyEl = document.createElement('div');
  companyEl.style.cssText = 'font-size: 1.1em; color: #1e293b; font-weight: 600; margin-bottom: 6px;';
  companyEl.textContent = `Company: ${compactJobText(job.company, 'Not specified', 65)}`;

  // Location
  const locationEl = document.createElement('div');
  locationEl.style.cssText = 'color: #475569; margin-bottom: 6px;';
  locationEl.innerHTML = `<strong>📍 Location:</strong> ${escapeHtml(compactJobText(job.location, 'Remote', 45))}`;

  // Job Link (if available)
  const linkEl = document.createElement('div');
  linkEl.style.cssText = 'margin-bottom: 12px;';
  const resolvedImported = resolveJobUrl(job);
  if (resolvedImported.href && resolvedImported.href !== '#') {
    const linkAnchor = document.createElement('a');
    linkAnchor.href = resolvedImported.href;
    linkAnchor.target = '_blank';
    linkAnchor.rel = 'noopener noreferrer';
    linkAnchor.textContent = resolvedImported.label === 'Open Job' ? '🔗 Open Original Job Listing' : '🔗 Find Original Job Listing';
    linkAnchor.style.cssText = 'color: #2563eb; text-decoration: underline; font-weight: 600; cursor: pointer;';
    linkEl.appendChild(linkAnchor);
  }

  // Actions (kept above description so save is immediately visible)
  const actions = document.createElement('div');
  actions.className = 'job-card-actions';
  actions.style.cssText = 'margin: 12px 0 14px 0; display: flex; gap: 10px;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save to Pipeline';
  saveBtn.style.cssText = 'flex: 1; padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
  saveBtn.addEventListener('click', async () => {
    try {
      await saveJobToBackend(job, 'saved');
      await loadTracker();
      importedJobBoxEl.innerHTML = '<div class="empty-state" style="color: #10b981; background: #ecfdf5; padding: 12px; border-radius: 6px;">✅ Job saved to pipeline! Check the Saved column.</div>';
    } catch (err) {
      alert(err.message);
    }
  });

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear Import';
  clearBtn.style.cssText = 'flex: 1; padding: 10px; background: #cbd5e1; color: #1e293b; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;';
  clearBtn.addEventListener('click', () => {
    document.getElementById('importJobUrl').value = '';
    document.getElementById('importJobText').value = '';
    importedJobBoxEl.innerHTML = '';
  });

  actions.append(saveBtn, clearBtn);

  // Job Description
  const descHeader = document.createElement('h4');
  descHeader.textContent = 'Job Description:';
  descHeader.style.cssText = 'margin: 14px 0 8px 0; color: #1e293b; font-size: 1em;';

  const descEl = document.createElement('div');
  descEl.style.cssText = `
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 12px;
    color: #334155;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-size: 0.95em;
    max-height: 300px;
    overflow-y: auto;
  `;
  descEl.textContent = job.description || 'No description available';

  wrapper.append(titleEl, companyEl, locationEl, linkEl, actions, descHeader, descEl);
  return wrapper;
}

function createTrackerCard(job) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mini-job-card tracker-job-card';

  const currentStatus = String(job.status || 'saved').toLowerCase();

  const titleEl = document.createElement('strong');
  titleEl.textContent = compactJobText(job.title, 'Untitled Job', 95);

  const companyEl = document.createElement('span');
  companyEl.textContent = compactJobText(job.company, 'Unknown Company', 65);

  const locationEl = document.createElement('small');
  locationEl.textContent = compactJobText(job.location, 'Location not provided', 45);

  // Create a clickable job source link
  const jobLinkEl = document.createElement('small');
  jobLinkEl.style.display = 'block';
  jobLinkEl.style.marginTop = '8px';
  const resolvedTracker = resolveJobUrl(job);
  if (resolvedTracker.href && resolvedTracker.href !== '#') {
    const linkAnchor = document.createElement('a');
    linkAnchor.href = resolvedTracker.href;
    linkAnchor.target = '_blank';
    linkAnchor.rel = 'noopener noreferrer';
    linkAnchor.textContent = resolvedTracker.label === 'Open Job' ? '🔗 View Original Job' : '🔗 Find Original Job';
    linkAnchor.style.color = '#2563eb';
    linkAnchor.style.textDecoration = 'underline';
    linkAnchor.style.cursor = 'pointer';
    jobLinkEl.appendChild(linkAnchor);
  } else {
    jobLinkEl.textContent = '🔗 Job source not available';
    jobLinkEl.style.color = '#94a3b8';
  }

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'tracker-actions';


  const select = document.createElement('select');
  const statuses = ['saved', 'ready', 'applied', 'interview', 'offer', 'rejected'];
  statuses.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    option.selected = currentStatus === status;
    select.appendChild(option);
  });
  // Add Remove from Tracker option
  const removeOption = document.createElement('option');
  removeOption.value = '__remove__';
  removeOption.textContent = 'Remove from Tracker';
  select.appendChild(removeOption);

  select.addEventListener('change', async () => {
    if (select.value === '__remove__') {
      if (confirm('Remove this job from your tracker?')) {
        try {
          await api(`/api/jobs/${job._id}`, { method: 'DELETE' });
          await loadTracker();
        } catch (err) {
          alert(err.message);
        }
      } else {
        select.value = currentStatus;
      }
      return;
    }
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
  wrapper.append(titleEl, document.createElement('br'), companyEl, document.createElement('br'), locationEl, jobLinkEl, document.createElement('br'), actionsDiv);

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

  const response = await api('/api/jobs/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (window.RoleRocketQuickstart) {
    window.RoleRocketQuickstart.completeStep('pipeline', 'job_saved');
  }

  return response;
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
        resume: document.getElementById('resumeText').value
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
  const urlInput = document.getElementById('importJobUrl');
  const descInput = document.getElementById('importJobText');
  
  // Validate URL is provided
  const jobUrl = urlInput.value.trim();
  if (!jobUrl) {
    importedJobBoxEl.innerHTML = '<div class="empty-state">❌ Job URL is required. Please paste a job listing URL.</div>';
    return;
  }

  // Validate URL format
  let validUrl;
  try {
    validUrl = new URL(jobUrl);
  } catch {
    importedJobBoxEl.innerHTML = '<div class="empty-state">❌ Invalid URL format. Please provide a valid job listing URL (e.g., https://example.com/job/123).</div>';
    return;
  }

  importedJobBoxEl.innerHTML = '<div class="empty-state">🔄 Fetching job data from URL...</div>';

  try {
    const data = await api('/api/jobs/import', {
      method: 'POST',
      body: JSON.stringify({
        sourceUrl: jobUrl,
        additionalNotes: descInput.value.trim() || ''
      })
    });

    importedJobBoxEl.innerHTML = '';
    importedJobBoxEl.appendChild(createImportedJobCard(data.job));
    
    // Clear inputs after successful import
    urlInput.value = '';
    descInput.value = '';
  } catch (err) {
    let errorMsg = err.message;
    // Provide helpful error messages
    if (errorMsg.toLowerCase().includes('unable to fetch') || errorMsg.toLowerCase().includes('failed to parse')) {
      errorMsg = 'Could not fetch the job from that URL. Please ensure the URL is correct and publicly accessible.';
    }
    importedJobBoxEl.innerHTML = `<div class="empty-state">❌ ${escapeHtml(errorMsg)}</div>`;
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
})();
