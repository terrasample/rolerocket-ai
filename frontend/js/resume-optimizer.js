// Resume Optimizer logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveResumePdfBtn');
  const saveWordBtn = document.getElementById('saveResumeWordBtn');
  const rewriteBtn = document.getElementById('rewriteResumeBtn');
  const clearFieldsBtn = document.getElementById('clearResumeOptimizerFieldsBtn');
  const output = document.getElementById('resumeOutput');
  const resumeUploadInput = document.getElementById('resumeBaseUpload');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessage');
  let lastResume = '';

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
        const res = await fetch('/api/resume/upload', {
          method: 'POST',
          headers,
          body: formData
        });
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
    } catch (error) {
      if (messageEl) {
        messageEl.textContent = error.message || 'Could not load the uploaded resume.';
        messageEl.style.color = '#dc2626';
      }
    }
  }

  resumeUploadInput?.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    await loadResumeFileIntoField(file, document.getElementById('resumeBase'), resumeUploadMessage);
  });

  function buildJobDescription(jobTitle, company, fullJobDescription) {
    return [
      `Job Title: ${jobTitle}`,
      company ? `Company: ${company}` : '',
      '',
      'Full Job Description:',
      fullJobDescription
    ].filter(Boolean).join('\n');
  }

  rewriteBtn?.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitle').value.trim();
    const company = document.getElementById('resumeCompany').value.trim();
    const baseResume = document.getElementById('resumeBase').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescription').value.trim();
    if (!jobTitle || !baseResume || !fullJobDescription) {
      output.innerHTML = '<div style="color:#dc2626;">Please add the job title, your resume, and the full job description.</div>';
      return;
    }
    output.innerHTML = 'Rewriting resume...';
    try {
      const jobDescription = buildJobDescription(jobTitle, company, fullJobDescription);
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume: baseResume })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        lastResume = data.result;
        output.innerHTML = `<pre style="background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;">${data.result}</pre>`;
      } else {
        lastResume = '';
        output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'Failed to rewrite resume.'}</div>`;
      }
    } catch (error) {
      lastResume = '';
      output.innerHTML = '<div style="color:#dc2626;">Error rewriting resume.</div>';
    }
  });

  function formatResumeForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 20;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Optimized Resume', 10, y);
    y += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    lines.forEach(line => {
      if (/^### /.test(line)) {
        y += 8;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^### /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^## /.test(line)) {
        y += 8;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^## /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 5;
      } else if (/^# /.test(line)) {
        y += 10;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^# /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^\d+\. /.test(line)) {
        doc.text(line, 14, y);
        y += 6;
      } else if (/^- /.test(line)) {
        doc.text(line.replace(/^- /, '\u2022 '), 18, y);
        y += 6;
      } else if (/^\*\*.*\*\*$/.test(line)) {
        doc.setFont('times', 'bold');
        doc.text(line.replace(/\*\*/g, ''), 10, y);
        doc.setFont('times', 'normal');
        y += 6;
      } else if (line.trim() === '') {
        y += 4;
      } else {
        doc.text(line, 10, y);
        y += 6;
      }
      if (y > 270) { doc.addPage(); y = 20; }
    });
  }

  if (savePdfBtn) {
    savePdfBtn.onclick = function() {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatResumeForPdf(lastResume, doc);
      doc.save('resume.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  function formatResumeForWord(text) {
    return (
      'Optimized Resume\n\n' +
      text
        .replace(/^### (.*)$/gm, '\n\n$1\n' + '-'.repeat(40))
        .replace(/^## (.*)$/gm, '\n\n$1\n' + '-'.repeat(30))
        .replace(/^# (.*)$/gm, '\n\n$1\n' + '-'.repeat(20))
        .replace(/\*\*(.*?)\*\*/g, '$1'.toUpperCase())
        .replace(/^- /gm, '  • ')
        .replace(/\n{2,}/g, '\n\n')
    );
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
        return;
      }
      const content = formatResumeForWord(lastResume);
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${content.replace(/\n/g, '<br>')}</body></html>`;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'resume.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }

  clearFieldsBtn?.addEventListener('click', function () {
    const jobTitle = document.getElementById('resumeJobTitle');
    const company = document.getElementById('resumeCompany');
    const baseResume = document.getElementById('resumeBase');
    const jobDescription = document.getElementById('resumeJobDescription');

    if (jobTitle) jobTitle.value = '';
    if (company) company.value = '';
    if (baseResume) baseResume.value = '';
    if (jobDescription) jobDescription.value = '';
    if (resumeUploadInput) resumeUploadInput.value = '';

    if (resumeUploadMessage) {
      resumeUploadMessage.textContent = '';
      resumeUploadMessage.style.color = '#64748b';
    }

    lastResume = '';
    output.innerHTML = '<div style="color:#166534;background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:10px 12px;">Fields cleared. Add new details to optimize another resume.</div>';
  });
});
