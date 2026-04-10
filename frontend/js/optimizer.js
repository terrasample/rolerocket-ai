// --- New ATS Optimizer Button Logic ---
document.getElementById('analyzeResumeBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();
  setOptimizerStatus('Analyzing resume...');
  if (!jobDescription || !resume) {
    alert('Paste both the job description and the resume.');
    setOptimizerStatus('');
    return;
  }
  try {
    const res = await fetch(apiUrl('/api/ats/analyze'), {
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
    renderTags('matchedKeywords', analysis.matchedKeywords, 'No matched keywords yet.');
    renderTags('missingKeywords', analysis.missingKeywords, 'No missing keywords found.');
    renderList('formattingWarnings', analysis.formattingWarnings, 'No formatting warnings.');
    renderList('quickFixes', analysis.quickFixes, 'No quick fixes suggested.');
    renderRewrites(analysis.rewrittenBullets);
    setOptimizerStatus('Analysis complete.');
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Failed to analyze ATS score', true);
  }
});

document.getElementById('applyFixBtn')?.addEventListener('click', () => {
  // Example: Apply quick fixes (mock logic)
  setOptimizerStatus('Applied quick fixes to resume. (mock)');
});

document.getElementById('saveAtsResumeBtn')?.addEventListener('click', async () => {
  const resume = document.getElementById('atsResume').value.trim();
  if (!resume) {
    alert('No resume content to save.');
    return;
  }
  setOptimizerStatus('Saving resume...');
  try {
    const res = await fetch(apiUrl('/api/resume/save'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content: resume, title: 'ATS Optimized Resume' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save resume');
    }
    setOptimizerStatus('Resume saved!');
  } catch (err) {
    setOptimizerStatus(err.message || 'Failed to save resume', true);
  }
});

document.getElementById('downloadAtsReportBtn')?.addEventListener('click', () => {
  // Example: Download ATS report as PDF (mock logic)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const score = document.getElementById('atsScore').textContent;
  const matched = document.getElementById('matchedKeywords').textContent;
  const missing = document.getElementById('missingKeywords')?.textContent || '';
  doc.text(`ATS Score: ${score}\nMatched: ${matched}\nMissing: ${missing}`, 10, 20);
  doc.save('ats-report.pdf');
});
const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');

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


function setOptimizerStatus(msg, isError = false) {
  const el = document.getElementById('optimizerStatus');
  if (el) {
    el.textContent = msg;
    el.style.color = isError ? '#dc2626' : '#2563eb';
  }
}

document.getElementById('runATSBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();
  setOptimizerStatus('Analyzing resume...');
  if (!jobDescription || !resume) {
    alert('Paste both the job description and the resume.');
    setOptimizerStatus('');
    return;
  }
  try {
    const res = await fetch(apiUrl('/api/ats/analyze'), {
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
    renderTags('matchedKeywords', analysis.matchedKeywords, 'No matched keywords yet.');
    renderTags('missingKeywords', analysis.missingKeywords, 'No missing keywords found.');
    renderList('formattingWarnings', analysis.formattingWarnings, 'No formatting warnings.');
    renderList('quickFixes', analysis.quickFixes, 'No quick fixes suggested.');
    renderRewrites(analysis.rewrittenBullets);
    setOptimizerStatus('Analysis complete.');
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Failed to analyze ATS score', true);
  }
});

document.getElementById('rewriteBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();
  setOptimizerStatus('Rewriting resume...');
  if (!jobDescription || !resume) {
    alert('Paste both the job description and the resume.');
    setOptimizerStatus('');
    return;
  }
  try {
    const res = await fetch(apiUrl('/api/ats/rewrite'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ jobDescription, resume })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to rewrite resume');
    }
    document.getElementById('rewriteOutput').textContent = data.rewritten || 'No rewrite result.';
    setOptimizerStatus('Rewrite complete. Review and Apply Fix if satisfied.');
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Failed to rewrite resume', true);
  }
});

document.getElementById('applyFixBtn')?.addEventListener('click', () => {
  const output = document.getElementById('rewriteOutput').textContent.trim();
  if (!output) {
    alert('No rewritten resume to apply.');
    return;
  }
  document.getElementById('atsResume').value = output;
  setOptimizerStatus('Applied AI rewrite to resume.');
});

document.getElementById('saveResumeBtn')?.addEventListener('click', async () => {
  const resume = document.getElementById('atsResume').value.trim();
  if (!resume) {
    alert('No resume content to save.');
    return;
  }
  setOptimizerStatus('Saving resume...');
  try {
    const res = await fetch(apiUrl('/api/resume/save'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content: resume, title: 'ATS Optimized Resume' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save resume');
    }
    setOptimizerStatus('Resume saved!');
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Failed to save resume', true);
  }
});

