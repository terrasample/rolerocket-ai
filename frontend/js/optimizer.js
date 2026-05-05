let latestAtsAnalysis = null;

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

// --- New ATS Optimizer Button Logic ---
document.getElementById('analyzeResumeBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();
  const mode = document.getElementById('atsMode')?.value || 'true-like';
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
      body: JSON.stringify({ jobDescription, resume, mode })
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
    latestAtsAnalysis = analysis;
    document.getElementById('atsScore').textContent = analysis.atsScore || 0;
    renderScoreBreakdown(analysis);
    renderTags('matchedKeywords', analysis.matchedKeywords, 'No matched keywords yet.');
    renderTags('missingKeywords', analysis.missingKeywords, 'No missing keywords found.');
    renderAnalysisWarnings(analysis.redFlags, analysis.formattingWarnings, analysis.quickFixes);
    renderBulletScores(analysis.bulletScores);
    renderRewrites(analysis.rewrittenBullets);
    const modeLabel = analysis.analysisMode === 'basic' ? 'Basic Keyword ATS' : 'True-like ATS';
    setOptimizerStatus(`Analysis complete (${modeLabel}).`);
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Failed to analyze ATS score', true);
    alert(err.message || 'Failed to analyze ATS score.');
  } finally {
    showLoadingSpinner(false);
  }
});

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMatchedTable(pairs) {
  const container = document.getElementById('matchedKeywords');
  if (!container) return;

  const explainer = '<div style="font-size:0.88em;color:#64748b;margin-bottom:12px;line-height:1.5;">Matched keywords are job-description terms that were found in your resume text after normalization. It is possible to have zero matches if wording is very different.</div>';

  if (!pairs || !pairs.length) {
    container.innerHTML = `${explainer}<div class="urgency-empty">No matched keywords yet.</div>`;
    return;
  }

  container.innerHTML = `
    ${explainer}
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.92em;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:9px 12px;text-align:left;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;width:50%;">Resume Term</th>
            <th style="padding:9px 12px;text-align:left;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;width:50%;">JD Term</th>
          </tr>
        </thead>
        <tbody>
          ${pairs.map((pair, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
              <td style="padding:8px 12px;color:#166534;font-weight:600;border-bottom:1px solid #f1f5f9;">${escapeHtml(pair.resumeTerm || '')}</td>
              <td style="padding:8px 12px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${escapeHtml(pair.jdTerm || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMissingWithReasons(items) {
  const container = document.getElementById('missingKeywords');
  if (!container) return;

  const explainer = '<div style="font-size:0.88em;color:#64748b;margin-bottom:12px;line-height:1.5;">Missing keywords are terms the ATS extractor expects from the job description but did not detect in your resume. Some extracted phrases can look awkward; use them as guidance, not exact copy-and-paste text.</div>';

  if (!items || !items.length) {
    container.innerHTML = `${explainer}<div class="urgency-empty">No missing keywords found.</div>`;
    return;
  }

  container.innerHTML = `
    ${explainer}
    <ul style="margin:0;padding-left:22px;display:grid;gap:10px;list-style:disc;">
      ${items.map((item) => {
        const keyword = escapeHtml(String(item.keyword || item || ''));
        const reason = item.reason ? ` <span style="color:#64748b;font-weight:400;">(${escapeHtml(item.reason)})</span>` : '';
        return `<li style="font-size:0.95em;line-height:1.6;color:#0f172a;"><strong style="color:#dc2626;">${keyword}</strong>${reason}</li>`;
      }).join('')}
    </ul>
  `;
}

function renderKeyChanges(changes) {
  const card = document.getElementById('keyChangesCard');
  const container = document.getElementById('keyChanges');
  if (!container) return;

  if (!changes || !changes.length) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = 'block';
  container.innerHTML = `
    <ol style="margin:0;padding-left:22px;display:grid;gap:8px;">
      ${changes.map((change) => `
        <li style="font-size:0.95em;line-height:1.55;color:#0f172a;">${escapeHtml(String(change || ''))}</li>
      `).join('')}
    </ol>
  `;
}

document.getElementById('fullAnalysisBtn')?.addEventListener('click', async () => {
  const jobDescription = document.getElementById('atsJobDescription').value.trim();
  const resume = document.getElementById('atsResume').value.trim();

  if (!jobDescription || !resume) {
    alert('Paste both the job description and the resume.');
    return;
  }

  setOptimizerStatus('Running full AI analysis…');
  showLoadingSpinner(true);

  try {
    const res = await fetch(apiUrl('/api/ats/full-analysis'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jobDescription, resume })
    });
    let data;
    try { data = await res.json(); } catch (_) { throw new Error('Invalid server response. Please try again.'); }
    if (!res.ok) throw new Error(data.error || 'Full AI analysis failed.');

    // Analysis header banner
    const banner = document.getElementById('atsAnalysisBanner');
    if (banner && data.jobTitle) {
      banner.textContent = `ATS Analysis: ${data.jobTitle}`;
      banner.style.display = 'block';
    }

    // Score (from rule-based scorer)
    document.getElementById('atsScore').textContent = data.atsScore || 0;
    renderScoreBreakdown({ scoreBreakdown: data.scoreBreakdown, analysisMode: data.analysisMode });

    // Matched Keywords — two-column table
    renderMatchedTable(data.matchedPairs || []);

    // Missing Keywords — bold keyword + reason
    renderMissingWithReasons(data.missingKeywords || []);

    // Rewritten Resume
    const rewriteEl = document.getElementById('rewriteOutput');
    if (rewriteEl) rewriteEl.textContent = data.rewrittenResume || '';

    // Key Changes Made
    renderKeyChanges(data.keyChanges || []);

    // Red Flags + Bullet Scores from rule-based scorer
    if (data.redFlags) renderAnalysisWarnings(data.redFlags, [], []);
    if (data.bulletScores) renderBulletScores(data.bulletScores);

    setOptimizerStatus('Full AI analysis complete. Review the rewritten resume below, then click "Copy Rewrite to Resume Field" to apply it.');
  } catch (err) {
    console.error(err);
    setOptimizerStatus(err.message || 'Full AI analysis failed.', true);
  } finally {
    showLoadingSpinner(false);
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
  if (!latestAtsAnalysis) {
    alert('Run Analyze Resume first to generate a report.');
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library not loaded. Please refresh the page and try again.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let yPos = 20;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const maxWidth = doc.internal.pageSize.width - 2 * margin;

  function addHeading(text, size = 14) {
    if (yPos + lineHeight > pageHeight - 10) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFontSize(size);
    doc.setFont(undefined, 'bold');
    doc.text(text, margin, yPos);
    yPos += lineHeight + 3;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
  }

  function addLine(text, indent = 0) {
    if (yPos + lineHeight > pageHeight - 10) {
      doc.addPage();
      yPos = margin;
    }
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    doc.text(lines, margin + indent, yPos);
    yPos += lines.length * lineHeight;
  }

  function addNumberedItems(items, indent = 3) {
    items.forEach((item, index) => {
      addLine(`${index + 1}. ${item}`, indent);
    });
  }

  // Title
  addHeading('ATS Analysis Report', 16);
  yPos += 3;

  const modeLabel = latestAtsAnalysis.analysisMode === 'basic' ? 'Basic Keyword ATS' : 'True-like ATS';
  addLine(`Mode: ${modeLabel}`, 0);
  yPos += 2;

  // Score Section
  addHeading('ATS Score', 12);
  addLine(`Score: ${latestAtsAnalysis.atsScore || 0}`);
  if (latestAtsAnalysis.scoreBreakdown) {
    const b = latestAtsAnalysis.scoreBreakdown;
    if (latestAtsAnalysis.analysisMode === 'true-like') {
      addLine(`Weighted keyword coverage: ${b.weightedKeywordCoveragePct || 0}%`, 3);
      addLine(`Must-have score: ${b.mustHaveScore || 0}/20`, 3);
      addLine(`Bullet contribution: ${b.bulletScoreContribution || 0}`, 3);
    } else {
      addLine(`Keyword coverage: ${b.keywordCoveragePct || 0}%`, 3);
      addLine(`Bullet contribution: ${b.bulletScoreContribution || 0}`, 3);
    }
  }
  yPos += 3;

  // Matched Keywords
  addHeading('Matched Keywords', 12);
  if (latestAtsAnalysis.matchedKeywords && latestAtsAnalysis.matchedKeywords.length) {
    addNumberedItems(latestAtsAnalysis.matchedKeywords, 3);
  } else {
    addLine('No matched keywords found.');
  }
  yPos += 3;

  // Missing Keywords
  addHeading('Missing Keywords', 12);
  if (latestAtsAnalysis.missingKeywords && latestAtsAnalysis.missingKeywords.length) {
    addNumberedItems(latestAtsAnalysis.missingKeywords, 3);
  } else {
    addLine('No missing keywords identified.');
  }
  yPos += 3;

  if (latestAtsAnalysis.mustHaveMissing && latestAtsAnalysis.mustHaveMissing.length) {
    addHeading('Missing Must-Haves', 12);
    addNumberedItems(latestAtsAnalysis.mustHaveMissing, 3);
    yPos += 3;
  }

  // Red Flags
  if (latestAtsAnalysis.redFlags && latestAtsAnalysis.redFlags.length) {
    addHeading('Red Flags', 12);
    latestAtsAnalysis.redFlags.forEach(flag => addLine(`• ${flag}`, 3));
    yPos += 3;
  }

  // Formatting Warnings
  if (latestAtsAnalysis.formattingWarnings && latestAtsAnalysis.formattingWarnings.length) {
    addHeading('Formatting Warnings', 12);
    latestAtsAnalysis.formattingWarnings.forEach(warning => addLine(`• ${warning}`, 3));
    yPos += 3;
  }

  // Quick Fixes
  if (latestAtsAnalysis.quickFixes && latestAtsAnalysis.quickFixes.length) {
    addHeading('Quick Fixes', 12);
    latestAtsAnalysis.quickFixes.forEach(fix => addLine(`• ${fix}`, 3));
    yPos += 3;
  }

  // Bullet Scores
  if (latestAtsAnalysis.bulletScores && latestAtsAnalysis.bulletScores.length) {
    addHeading('Bullet Scores', 12);
    latestAtsAnalysis.bulletScores.forEach(bullet => {
      addLine(`Score: ${bullet.score}`, 3);
      addLine(`${bullet.text.substring(0, 100)}${bullet.text.length > 100 ? '...' : ''}`, 6);
    });
    yPos += 3;
  }

  // AI Rewritten Bullets
  if (latestAtsAnalysis.rewrittenBullets && latestAtsAnalysis.rewrittenBullets.length) {
    addHeading('AI Rewrite Suggestions', 12);
    latestAtsAnalysis.rewrittenBullets.forEach((bullet, idx) => {
      addLine(`Suggestion ${idx + 1}:`, 3);
      addLine(`Original: ${bullet.original}`, 6);
      addLine(`Improved: ${bullet.improved}`, 6);
      yPos += 2;
    });
  }

  // Next Steps
  addHeading('Next Steps', 12);
  addLine('1. Apply the AI fixes to your resume with the "Apply Fix" button.', 3);
  addLine('2. Re-run "Analyze Resume" with the same job description.', 3);
  addLine('3. Your score will improve with stronger keyword matching.', 3);
  addLine('4. Target: 80+ for strong ATS compatibility.', 3);

  doc.save('ats-report.pdf');
});
const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
const atsResumeUploadInput = document.getElementById('atsResumeUpload');
const atsResumeUploadBtn = document.getElementById('uploadAtsResumeBtn');
const atsResumeUploadMessage = document.getElementById('atsResumeUploadMessage');

if (!token) {
  window.location.href = 'login.html';
}

async function loadResumeFileIntoAtsField(file) {
  const resumeField = document.getElementById('atsResume');
  if (!file || !resumeField) return;

  if (atsResumeUploadMessage) {
    atsResumeUploadMessage.textContent = 'Loading resume file...';
    atsResumeUploadMessage.style.color = '#64748b';
  }

  try {
    if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const formData = new FormData();
      formData.append('resumeFile', file);

      const res = await fetch(apiUrl('/api/resume/upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse uploaded resume.');
      resumeField.value = data.content || '';
    } else if (file.type.startsWith('text/') || /\.(txt|md|rtf)$/i.test(file.name)) {
      resumeField.value = await file.text();
    } else {
      throw new Error('Use a TXT, PDF, or DOCX resume file.');
    }

    if (atsResumeUploadMessage) {
      atsResumeUploadMessage.textContent = `Loaded ${file.name}.`;
      atsResumeUploadMessage.style.color = '#16a34a';
    }

    setOptimizerStatus('Resume uploaded successfully.');
  } catch (error) {
    if (atsResumeUploadMessage) {
      atsResumeUploadMessage.textContent = error.message || 'Could not load the uploaded resume.';
      atsResumeUploadMessage.style.color = '#dc2626';
    }

    setOptimizerStatus(error.message || 'Could not load the uploaded resume.', true);
  }
}

atsResumeUploadBtn?.addEventListener('click', () => {
  atsResumeUploadInput?.click();
});

atsResumeUploadInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await loadResumeFileIntoAtsField(file);
});

function renderTags(containerId, items, emptyMessage) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isMatchedList = containerId === 'matchedKeywords';
  const isMissingList = containerId === 'missingKeywords';

  const explainer = isMatchedList
    ? '<div style="font-size:0.88em;color:#64748b;margin-bottom:12px;line-height:1.5;">Matched keywords are job-description terms that were found in your resume text after normalization. It is possible to have zero matches if wording is very different.</div>'
    : (isMissingList
      ? '<div style="font-size:0.88em;color:#64748b;margin-bottom:12px;line-height:1.5;">Missing keywords are terms the ATS extractor expects from the job description but did not detect in your resume. Some extracted phrases can look awkward; use them as guidance, not exact copy-and-paste text.</div>'
      : '');

  if (!items || !items.length) {
    const matchedEmptyNote = isMatchedList
      ? '<div style="margin-top:8px;font-size:0.88em;color:#64748b;line-height:1.45;">Try adding explicit role terms from the job description into your summary, experience bullets, and skills section.</div>'
      : '';
    container.innerHTML = `${explainer}<div class="urgency-empty">${emptyMessage}</div>${matchedEmptyNote}`;
    return;
  }

  function renderItem(item, index) {
    const isMustHave = /\(must-have\)$/i.test(String(item || ''));
    const termText = String(item || '').replace(/\s*\(must-have\)$/i, '').trim();

    if (isMatchedList) {
      // Matched: clean pill chip, light background, no must-have label needed
      return `
        <li style="font-size:0.95em;line-height:1.5;color:#0f172a;overflow-wrap:anywhere;">
          <span style="display:inline-block;max-width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;padding:5px 14px;font-weight:600;white-space:normal;overflow-wrap:anywhere;word-break:break-word;color:#15803d;">${termText}</span>
        </li>`;
    }

    // Missing: pill chip with bold term + distinct (must-have) label when applicable
    const mustHaveBadge = isMustHave
      ? ` <span style="display:inline-block;font-size:0.78em;font-weight:700;color:#b45309;background:#fef3c7;border:1px solid #fde68a;border-radius:999px;padding:1px 8px;vertical-align:middle;white-space:nowrap;">(must-have)</span>`
      : '';

    return `
      <li style="font-size:0.95em;line-height:1.5;color:#0f172a;overflow-wrap:anywhere;">
        <span style="display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;max-width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:6px 12px;white-space:normal;overflow-wrap:anywhere;word-break:break-word;">
          <strong style="font-weight:700;color:#0f172a;">${termText}</strong>${mustHaveBadge}
        </span>
      </li>`;
  }

  container.innerHTML = `
    ${explainer}
    <ol style="margin:0;padding-left:22px;display:grid;gap:10px;">
      ${items.map((item, i) => renderItem(item, i)).join('')}
    </ol>
  `;
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

function renderAnalysisWarnings(redFlags, formattingWarnings, quickFixes) {
  const container = document.getElementById('redFlags');
  if (!container) return;

  const sections = [];

  if (redFlags && redFlags.length) {
    sections.push(`
      <div class="job-result-card">
        <strong>Red Flags</strong>
        <ul class="urgency-reason-list">${redFlags.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    `);
  }

  if (formattingWarnings && formattingWarnings.length) {
    sections.push(`
      <div class="job-result-card">
        <strong>Formatting Warnings</strong>
        <ul class="urgency-reason-list">${formattingWarnings.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    `);
  }

  if (quickFixes && quickFixes.length) {
    sections.push(`
      <div class="job-result-card">
        <strong>Quick Fixes</strong>
        <ul class="urgency-reason-list">${quickFixes.map((item) => `<li>${item}</li>`).join('')}</ul>
      </div>
    `);
  }

  container.innerHTML = sections.length
    ? sections.join('')
    : '<div class="urgency-empty">No red flags to display.</div>';
}

function renderBulletScores(items) {
  const container = document.getElementById('bulletScores');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<div style="font-size:0.9em;color:#666;">No bullet scores to display.</div>';
    return;
  }

  const rubricNote = `
    <div style="font-size:0.82em;color:#64748b;padding:6px 8px 10px 8px;line-height:1.4;">
      Scored on a 100-point rubric: +30 metric, +30 strong action verb, +20 impact verb, +20 detail length, -20 weak phrasing.
    </div>
  `;

  container.innerHTML = rubricNote + items.map((item) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px;border-bottom:1px solid #e2e8f0;font-size:0.9em;gap:12px;">
      <div style="flex:1;color:#666;line-height:1.4;">${item.text.substring(0, 80)}${item.text.length > 80 ? '...' : ''}</div>
      <div style="font-weight:bold;color:#2563eb;min-width:64px;text-align:right;">${item.score}/100</div>
    </div>
  `).join('');
}

function renderScoreBreakdown(analysis) {
  const container = document.getElementById('atsScoreBreakdown');
  if (!container) return;

  const b = analysis?.scoreBreakdown;
  if (!b) {
    container.innerHTML = '';
    return;
  }

  if (analysis.analysisMode === 'true-like') {
    container.innerHTML = `
      <div style="font-weight:700;color:#1e293b;margin-bottom:6px;">How this score is calculated (0-100)</div>
      <div>Weighted keyword score: <strong>${b.weightedKeywordScore || 0}</strong> (coverage ${b.weightedKeywordCoveragePct || 0}% x 55)</div>
      <div>Must-have score: <strong>${b.mustHaveScore || 0}</strong> / 20 (${b.mustHaveMatched || 0} matched, ${b.mustHaveMissing || 0} missing)</div>
      <div>Bullet contribution: <strong>${b.bulletScoreContribution || 0}</strong> (avg ${b.bulletAverage || 0} x 0.15)</div>
      <div>Section health: <strong>${b.sectionHealth || 0}</strong> / 10</div>
      <div>Formatting health: <strong>${b.formattingHealth || 0}</strong> / 15</div>
      <div>Depth bonus: <strong>${b.depthBonus || 0}</strong> / 2</div>
      <div style="margin-top:6px;color:#64748b;">A zero matched-keyword result means the analyzer could not find overlapping terms between the job description and your resume wording. This is common when phrasing differs even if experience is relevant.</div>
      <div style="margin-top:6px;color:#64748b;">Final ATS score is rounded to the nearest whole number.</div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="font-weight:700;color:#1e293b;margin-bottom:6px;">How this score is calculated (0-100)</div>
    <div>Keyword score: <strong>${b.keywordScore || 0}</strong> (coverage ${b.keywordCoveragePct || 0}% x 45)</div>
    <div>Bullet contribution: <strong>${b.bulletScoreContribution || 0}</strong> (avg ${b.bulletAverage || 0} x 0.25)</div>
    <div>Section score: <strong>${b.sectionScore || 0}</strong> / 20</div>
    <div>Formatting score: <strong>${b.formattingScore || 0}</strong> / 15</div>
    <div>Depth score: <strong>${b.depthScore || 0}</strong></div>
    <div style="margin-top:6px;color:#64748b;">A zero matched-keyword result means the analyzer could not find overlapping terms between the job description and your resume wording. This can happen when equivalent skills are written with different phrasing.</div>
    <div style="margin-top:6px;color:#64748b;">Final ATS score is rounded to the nearest whole number.</div>
  `;
}

function renderRewrites(items) {
  const container = document.getElementById('rewriteOutput');
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = '<div style="color:#16a34a;font-size:0.95em;padding:8px 0;">✓ All bullets look strong. No rewrites needed.</div>';
    return;
  }

  container.innerHTML = items.map((item, i) => `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;background:#0f172a;">
      <div style="font-size:0.75em;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Original</div>
      <div style="color:#cbd5e1;font-size:0.92em;line-height:1.6;margin-bottom:12px;border-left:3px solid #475569;padding-left:10px;">${item.original}</div>
      <div style="font-size:0.75em;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">⚡ Improved</div>
      <div style="color:#e2e8f0;font-size:0.95em;line-height:1.6;border-left:3px solid #38bdf8;padding-left:10px;">${item.improved}</div>
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
    latestAtsAnalysis = analysis;
    document.getElementById('atsScore').textContent = analysis.atsScore || 0;
    renderScoreBreakdown(analysis);
    renderTags('matchedKeywords', analysis.matchedKeywords, 'No matched keywords yet.');
    renderTags('missingKeywords', analysis.missingKeywords, 'No missing keywords found.');
    renderAnalysisWarnings(analysis.redFlags, analysis.formattingWarnings, analysis.quickFixes);
    renderBulletScores(analysis.bulletScores);
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

document.getElementById('copyRewriteToResumeBtn')?.addEventListener('click', () => {
  const output = document.getElementById('rewriteOutput').textContent.trim();
  if (!output) {
    alert('No rewritten resume to apply. Run Full AI Analysis first.');
    return;
  }
  document.getElementById('atsResume').value = output;
  setOptimizerStatus('Rewritten resume copied to Resume field. You can now download it as PDF or Word.');
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

document.getElementById('clearAtsFieldsBtn')?.addEventListener('click', () => {
  const jobDescriptionEl = document.getElementById('atsJobDescription');
  const resumeEl = document.getElementById('atsResume');
  const rewriteOutputEl = document.getElementById('rewriteOutput');
  const scoreEl = document.getElementById('atsScore');
  const breakdownEl = document.getElementById('atsScoreBreakdown');

  if (jobDescriptionEl) jobDescriptionEl.value = '';
  if (resumeEl) resumeEl.value = '';
  if (rewriteOutputEl) rewriteOutputEl.textContent = '';
  if (scoreEl) scoreEl.textContent = '0';
  if (breakdownEl) breakdownEl.innerHTML = '';
  latestAtsAnalysis = null;
  if (atsResumeUploadInput) atsResumeUploadInput.value = '';
  if (atsResumeUploadMessage) {
    atsResumeUploadMessage.textContent = '';
    atsResumeUploadMessage.style.color = '#64748b';
  }

  renderTags('matchedKeywords', [], 'No matched keywords yet.');
  renderTags('missingKeywords', [], 'No missing keywords found.');
  renderAnalysisWarnings([], [], []);
  renderBulletScores([]);

  const analysisBanner = document.getElementById('atsAnalysisBanner');
  if (analysisBanner) analysisBanner.style.display = 'none';
  const keyChangesCard = document.getElementById('keyChangesCard');
  if (keyChangesCard) keyChangesCard.style.display = 'none';
  const keyChangesEl = document.getElementById('keyChanges');
  if (keyChangesEl) keyChangesEl.innerHTML = '';

  setOptimizerStatus('Fields cleared. Add new details to analyze another resume.');
});

