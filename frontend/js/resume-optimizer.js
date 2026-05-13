// Resume Optimizer logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveResumePdfBtn');
  const saveWordBtn = document.getElementById('saveResumeWordBtn');
  const sendEmailBtn = document.getElementById('sendResumeEmailBtn');
  const rewriteBtn = document.getElementById('rewriteResumeBtn');
  const clearFieldsBtn = document.getElementById('clearResumeOptimizerFieldsBtn');
  const templateSelect = document.getElementById('resumeTemplate');
  const output = document.getElementById('resumeOutput');
  const resumeUploadInput = document.getElementById('resumeBaseUpload');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessage');
  let lastResume = '';

  const templateConfigs = {
    'blank-template': {
      label: 'Blank Template',
      prompt: 'Use a neutral resume structure with clear ATS-friendly headings and no stylistic assumptions.',
      preview: "font-family:'Times New Roman', Times, serif;",
      pdfFont: 'times',
      fileSuffix: 'blank-template'
    },
    'forest-ribbon': {
      label: 'Forest Ribbon',
      prompt: 'Use a forest-themed professional layout style with clear hierarchy and concise achievement bullets.',
      preview: "font-family:'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'forest-ribbon'
    },
    'gold-sidebar': {
      label: 'Golden Sidebar',
      prompt: 'Use a golden sidebar style with strong section clarity and concise role impact statements.',
      preview: "font-family:'Arial Narrow', Arial, sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'gold-sidebar'
    },
    'slate-modern': {
      label: 'Slate Modern',
      prompt: 'Use a slate modern style with compact spacing, clear section titles, and metrics-forward bullets.',
      preview: "font-family:'Segoe UI', Tahoma, Arial, sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'slate-modern'
    },
    'copper-clean': {
      label: 'Copper Clean',
      prompt: 'Use a copper clean layout style that balances readability with polished, professional tone.',
      preview: "font-family:'Georgia', 'Times New Roman', serif;",
      pdfFont: 'times',
      fileSuffix: 'copper-clean'
    },
    'midnight-column': {
      label: 'Midnight Column',
      prompt: 'Use a midnight column style emphasizing leadership and impact with bold, concise phrasing.',
      preview: "font-family:'Gill Sans', 'Segoe UI', sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'midnight-column'
    },
    'sage-editorial': {
      label: 'Sage Editorial',
      prompt: 'Use a sage editorial style with refined headings and balanced storytelling plus measurable results.',
      preview: "font-family:'Palatino Linotype', 'Book Antiqua', serif;",
      pdfFont: 'times',
      fileSuffix: 'sage-editorial'
    },
    'berry-executive': {
      label: 'Berry Executive',
      prompt: 'Use a berry executive style focused on strategic outcomes, team leadership, and business impact.',
      preview: "font-family:'Avenir Next', 'Segoe UI', sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'berry-executive'
    },
    'onyx-portfolio': {
      label: 'Onyx Portfolio',
      prompt: 'Use an onyx portfolio style with crisp section structure, modern phrasing, and concise impact bullets.',
      preview: "font-family:Arial, Helvetica, sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'onyx-portfolio'
    },
    'ocean-balance': {
      label: 'Ocean Balance',
      prompt: 'Use an ocean balance style with clean hierarchy, calm professional tone, and ATS-safe sectioning.',
      preview: "font-family:'Optima', 'Segoe UI', sans-serif;",
      pdfFont: 'helvetica',
      fileSuffix: 'ocean-balance'
    }
  };

  function getSelectedTemplate() {
    const selected = String(templateSelect?.value || 'blank-template').toLowerCase();
    return templateConfigs[selected] ? selected : 'blank-template';
  }

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

  function buildJobDescription(jobTitle, company, fullJobDescription, templateKey) {
    const template = templateConfigs[templateKey] || templateConfigs['blank-template'];
    return [
      `Job Title: ${jobTitle}`,
      company ? `Company: ${company}` : '',
      `Resume Template: ${template.label}`,
      `Template Guidance: ${template.prompt}`,
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
    const templateKey = getSelectedTemplate();
    const template = templateConfigs[templateKey];
    if (!jobTitle || !baseResume || !fullJobDescription) {
      output.innerHTML = '<div style="color:#dc2626;">Please add the job title, your resume, and the full job description.</div>';
      return;
    }
    output.innerHTML = 'Rewriting resume...';
    try {
      const jobDescription = buildJobDescription(jobTitle, company, fullJobDescription, templateKey);
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
        output.innerHTML = `<div style="margin:0 0 8px 0;font-weight:700;color:#334155;">Template: ${template.label}</div><pre style="background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.04em;line-height:1.65;color:#1e293b;${template.preview}border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;">${data.result}</pre>`;
      } else {
        lastResume = '';
        output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'Failed to rewrite resume.'}</div>`;
      }
    } catch (error) {
      lastResume = '';
      output.innerHTML = '<div style="color:#dc2626;">Error rewriting resume.</div>';
    }
  });

  function formatResumeForPdf(text, doc, templateKey) {
    const template = templateConfigs[templateKey] || templateConfigs['blank-template'];
    const lines = text.split(/\r?\n/);
    let y = 20;
    doc.setFont(template.pdfFont, 'bold');
    doc.setFontSize(12);
    doc.text(`Optimized Resume - ${template.label}`, 10, y);
    y += 10;
    doc.setFont(template.pdfFont, 'normal');
    doc.setFontSize(12);
    lines.forEach(line => {
      if (/^### /.test(line)) {
        y += 8;
        doc.setFont(template.pdfFont, 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^### /, ''), 10, y);
        doc.setFont(template.pdfFont, 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^## /.test(line)) {
        y += 8;
        doc.setFont(template.pdfFont, 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^## /, ''), 10, y);
        doc.setFont(template.pdfFont, 'normal');
        doc.setFontSize(12);
        y += 5;
      } else if (/^# /.test(line)) {
        y += 10;
        doc.setFont(template.pdfFont, 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^# /, ''), 10, y);
        doc.setFont(template.pdfFont, 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^\d+\. /.test(line)) {
        doc.text(line, 14, y);
        y += 6;
      } else if (/^- /.test(line)) {
        doc.text(line.replace(/^- /, '\u2022 '), 18, y);
        y += 6;
      } else if (/^\*\*.*\*\*$/.test(line)) {
        doc.setFont(template.pdfFont, 'bold');
        doc.text(line.replace(/\*\*/g, ''), 10, y);
        doc.setFont(template.pdfFont, 'normal');
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

  function createResumeOptimizerPdfBlob(text, templateKey) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    formatResumeForPdf(text, doc, templateKey);
    return doc.output('blob');
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
      const templateKey = getSelectedTemplate();
      const template = templateConfigs[templateKey];
      formatResumeForPdf(lastResume, doc, templateKey);
      doc.save(`resume-${template.fileSuffix}.pdf`);
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  function formatResumeForWord(text, templateKey) {
    const template = templateConfigs[templateKey] || templateConfigs['blank-template'];
    return (
      `Optimized Resume - ${template.label}\n\n` +
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
      const templateKey = getSelectedTemplate();
      const template = templateConfigs[templateKey];
      const content = formatResumeForWord(lastResume, templateKey);
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${content.replace(/\n/g, '<br>')}</body></html>`;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `resume-${template.fileSuffix}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }

  if (sendEmailBtn) {
    sendEmailBtn.onclick = async function () {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to send. Please rewrite first.</div>';
        return;
      }

      const templateKey = getSelectedTemplate();
      const template = templateConfigs[templateKey];

      const content = formatResumeForWord(lastResume, templateKey);
      const htmlContent = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${content.replace(/\n/g, '<br>')}</body></html>`;
      const pdfBlob = createResumeOptimizerPdfBlob(lastResume, templateKey);
      const wordBlob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
      sendEmailBtn.disabled = true;
      sendEmailBtn.textContent = 'Sending...';
      const result = await window.sendDocumentToAccountEmail({
        feature: `Resume Optimizer (${template.label})`,
        filename: `optimized-resume-${template.fileSuffix}`,
        htmlContent,
        textContent: lastResume,
        attachments: [
          { filename: `optimized-resume-${template.fileSuffix}.pdf`, blob: pdfBlob, contentType: 'application/pdf' },
          { filename: `optimized-resume-${template.fileSuffix}.doc`, blob: wordBlob, contentType: 'application/msword' }
        ]
      });
      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send to Email';

      output.innerHTML = result.ok
        ? '<div style="color:#16a34a;">Sent! Check your inbox — if you don\'t see it within a minute, check your spam or junk folder.</div>'
        : `<div style="color:#dc2626;">${result.error || 'Could not send email.'}</div>`;
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
    if (templateSelect) templateSelect.value = 'blank-template';
    if (resumeUploadInput) resumeUploadInput.value = '';

    if (resumeUploadMessage) {
      resumeUploadMessage.textContent = '';
      resumeUploadMessage.style.color = '#64748b';
    }

    lastResume = '';
    output.innerHTML = '<div style="color:#166534;background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:10px 12px;">Fields cleared. Add new details to optimize another resume.</div>';
  });
});
