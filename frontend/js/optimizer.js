const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'login.html';
}

function renderTags(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="urgency-empty">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => `<span class="urgency-badge">${item}</span>`)
    .join(' ');
}

function renderList(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="urgency-empty">${emptyMessage}</div>`;
    return;
  }

  container.innerHTML = `
    <ul class="urgency-reason-list">
      ${items.map((item) => `<li>${item}</li>`).join('')}
    </ul>
  `;
}

function renderRewrites(items) {
  const container = document.getElementById('rewrittenBullets');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="urgency-empty">No weak bullets found. Good job.</div>`;
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="job-result-card">
      <strong>Original</strong>
      <p>${item.original}</p>
      <strong>Improved</strong>
      <p>${item.improved}</p>
    </div>
  `).join('');
}

document.getElementById('runATSBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();

  if (!jobDescription || !resume) {
    alert('Paste both the job description and the resume.');
    return;
  }

  try {
    const res = await fetch('/api/ats/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ jobDescription, resume })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to run ATS analysis');
    }

    const analysis = data.analysis;

    document.getElementById('atsScore').textContent = analysis.atsScore || 0;
    document.getElementById('keywordScore').textContent = analysis.keywordScore || 0;
    document.getElementById('sectionScore').textContent = analysis.sectionScore || 0;
    document.getElementById('formattingScore').textContent = analysis.formattingScore || 0;

    renderTags('matchedKeywords', analysis.matchedKeywords, 'No matched keywords yet.');
    renderTags('missingKeywords', analysis.missingKeywords, 'No missing keywords found.');
    renderList('formattingWarnings', analysis.formattingWarnings, 'No formatting warnings.');
    renderList('quickFixes', analysis.quickFixes, 'No quick fixes suggested.');
    renderRewrites(analysis.rewrittenBullets);
  } catch (err) {
    console.error(err);
    alert(err.message || 'Failed to analyze ATS score');
  }
});

