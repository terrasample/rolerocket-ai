// --- New ATS Optimizer Button Logic ---
document.getElementById('analyzeResumeBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();
  setOptimizerStatus('Analyzing resume...');
  showLoadingSpinner(true);
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
    let data;
    try {
      data = await res.json();
    } catch (jsonErr) {
      throw new Error('Invalid server response. Please try again later.');
    }
    if (!res.ok || !data || !data.analysis) {
      throw new Error((data && data.error) || 'Failed to run ATS analysis. Please check your input and try again.');
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
    alert(err.message || 'Failed to analyze ATS score.');
  } finally {
    showLoadingSpinner(false);
  }
});

document.getElementById('applyFixBtn')?.addEventListener('click', () => {
  // Example: Apply quick fixes (mock logic)
  setOptimizerStatus('Applying quick fixes...');
  showLoadingSpinner(true);
  setTimeout(() => {
    setOptimizerStatus('Applied quick fixes to resume. (mock)');
    showLoadingSpinner(false);
  }, 800);

// Show/hide a loading spinner overlay
function showLoadingSpinner(show) {
  let spinner = document.getElementById('atsLoadingSpinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.id = 'atsLoadingSpinner';
    spinner.style.position = 'fixed';
    spinner.style.top = '0';
    spinner.style.left = '0';
    spinner.style.width = '100vw';
    spinner.style.height = '100vh';
    spinner.style.background = 'rgba(255,255,255,0.6)';
    spinner.style.display = 'flex';
    spinner.style.alignItems = 'center';
    spinner.style.justifyContent = 'center';
    spinner.style.zIndex = '9999';
    spinner.innerHTML = '<div style="border:8px solid #e0e7ef;border-top:8px solid #2563eb;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;"></div>';
    document.body.appendChild(spinner);
    const style = document.createElement('style');
    style.innerHTML = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  spinner.style.display = show ? 'flex' : 'none';
}
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

document.getElementById('saveAtsResumePdfBtn')?.addEventListener('click', () => {
  const resume = document.getElementById('atsResume').value.trim();
  if (!resume) {
    setOptimizerStatus('No resume content to save.', true);
    return;
  }
  if (!window.jspdf) {
    setOptimizerStatus('PDF library not loaded.', true);
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const text = resume.replace(/\n/g, '\n');
  doc.setFont('times');
  doc.setFontSize(12);
  doc.text(text, 10, 20, { maxWidth: 180 });
  doc.save('ats-optimized-resume.pdf');
  setOptimizerStatus('PDF downloaded!');
});

document.getElementById('saveAtsResumeWordBtn')?.addEventListener('click', () => {
  const resume = document.getElementById('atsResume').value.trim();
  if (!resume) {
    setOptimizerStatus('No resume content to save.', true);
    return;
  }
  const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${resume.replace(/\n/g, '<br>')}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ats-optimized-resume.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setOptimizerStatus('Word document downloaded!');
});

