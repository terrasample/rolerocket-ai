// Cover Letter Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveCoverPdfBtn');
  const saveWordBtn = document.getElementById('saveCoverWordBtn');
  const generateBtn = document.getElementById('generateCoverBtn');
  const clearFieldsBtn = document.getElementById('clearCoverFieldsBtn');
  const output = document.getElementById('coverLetterOutput');
  const resumeUploadInput = document.getElementById('coverResumeUpload');
  const resumeUploadMessage = document.getElementById('coverResumeUploadMessage');
  let lastCover = '';
  let lastCoverMeta = { name: '', phone: '', email: '' };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function extractContactInfo(sourceText) {
    const text = String(sourceText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const phone = (text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) || [])[0] || '';
    const nameLine = lines.find((line) => /^[A-Za-z][A-Za-z\s'.-]{2,}$/.test(line) && line.split(/\s+/).length <= 5) || '';
    return { name: nameLine, phone, email };
  }

  function parseCoverLetter(text) {
    const cleaned = String(text || '').replace(/\r/g, '').trim();
    const lines = cleaned.split('\n').map((line) => line.trim());
    const nonEmpty = lines.filter(Boolean);

    let greeting = 'Dear Hiring Manager,';
    let closing = 'Sincerely,';
    let signature = '';

    const greetIdx = nonEmpty.findIndex((line) => /^dear\b/i.test(line));
    if (greetIdx >= 0) greeting = nonEmpty[greetIdx];

    let closeIdx = nonEmpty.findIndex((line) => /^(sincerely|best regards|kind regards|warm regards|yours truly)/i.test(line));
    if (closeIdx >= 0) {
      closing = nonEmpty[closeIdx];
      signature = nonEmpty[closeIdx + 1] || '';
    }

    let bodyLines = nonEmpty;
    if (greetIdx >= 0) bodyLines = bodyLines.slice(greetIdx + 1);
    if (closeIdx >= 0) {
      const bodyEnd = Math.max(0, closeIdx - (greetIdx >= 0 ? (greetIdx + 1) : 0));
      bodyLines = bodyLines.slice(0, bodyEnd);
    }

    const paragraphs = bodyLines
      .join('\n')
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, ' ').trim())
      .filter(Boolean);

    return {
      greeting,
      paragraphs,
      closing,
      signature
    };
  }

  function renderCoverTemplate(letter, contact, roleTitle, company) {
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const paragraphHtml = letter.paragraphs.map((p) => `<p style="margin:0 0 12px 0;line-height:1.6;color:#1f2937;font-size:16px;">${escapeHtml(p)}</p>`).join('');

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
        <div style="max-width:760px;margin:0 auto;font-family:Calibri, Arial, sans-serif;color:#0f172a;">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #8ec7da;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:28px;font-weight:800;color:#0e6e98;line-height:1.05;">${escapeHtml(contact.name || 'Candidate')}</div>
              <div style="font-size:14px;color:#475569;">${escapeHtml([contact.phone, contact.email].filter(Boolean).join('  |  '))}</div>
            </div>
            <div style="font-size:13px;color:#64748b;text-align:right;">${escapeHtml(today)}</div>
          </div>

          <div style="font-size:14px;color:#334155;margin-bottom:12px;">
            <strong>Role:</strong> ${escapeHtml(roleTitle || 'Target Role')}<br>
            <strong>Company:</strong> ${escapeHtml(company || 'Target Company')}
          </div>

          <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:10px;">${escapeHtml(letter.greeting)}</div>

          ${paragraphHtml}

          <div style="margin-top:12px;font-size:16px;line-height:1.6;color:#1f2937;">
            <div>${escapeHtml(letter.closing)}</div>
            <div style="margin-top:6px;font-weight:700;">${escapeHtml(letter.signature || contact.name || '')}</div>
          </div>
        </div>
      </div>
    `;
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
    await loadResumeFileIntoField(file, document.getElementById('coverResume'), resumeUploadMessage);
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

  generateBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('coverJobTitle').value.trim();
    const company = document.getElementById('coverCompany').value.trim();
    const resume = document.getElementById('coverResume').value.trim();
    const fullJobDescription = document.getElementById('coverJobDescription').value.trim();
    if (!jobTitle || !resume || !fullJobDescription) {
      output.innerHTML = '<div style="color:#dc2626;">Please add the job title, your resume, and the full job description.</div>';
      return;
    }
    output.innerHTML = 'Generating cover letter...';
    lastCoverMeta = extractContactInfo(resume);
    try {
      const jobDescription = buildJobDescription(jobTitle, company, fullJobDescription);
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        lastCover = data.result;
        const letter = parseCoverLetter(lastCover);
        output.innerHTML = renderCoverTemplate(letter, lastCoverMeta, jobTitle, company);
      } else {
        lastCover = '';
        output.innerHTML = `<div style=\"color:#dc2626;font-size:1.1em;padding:12px 0;\">${data.error || 'Failed to generate cover letter.'}</div>`;
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating cover letter.</div>';
      lastCover = '';
    }
  });

  function formatCoverForPdf(text, doc) {
    const letter = parseCoverLetter(text);
    const marginLeft = 20;
    const maxWidth = 170;
    const lineHeight = 6;
    let y = 20;

    doc.setDrawColor(142, 199, 218);
    doc.setLineWidth(1.1);
    doc.line(marginLeft, y + 2, 190, y + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(14, 110, 152);
    doc.text(lastCoverMeta.name || 'Candidate', marginLeft, y);

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    const contactLine = [lastCoverMeta.phone, lastCoverMeta.email].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, marginLeft, y);

    y += 9;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(letter.greeting, marginLeft, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    letter.paragraphs.forEach((paragraph) => {
      const wrapped = doc.splitTextToSize(paragraph, maxWidth);
      wrapped.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, marginLeft, y);
        y += lineHeight;
      });
      y += 2;
    });

    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(letter.closing, marginLeft, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(letter.signature || lastCoverMeta.name || '', marginLeft, y);
  }

  if (savePdfBtn) {
    savePdfBtn.onclick = function() {
      if (!lastCover) {
        output.innerHTML = '<div style="color:#dc2626;">No cover letter to save. Please generate first.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatCoverForPdf(lastCover, doc);
      doc.save('tailored-cover-letter.pdf');
      const roleTitle = document.getElementById('coverJobTitle').value.trim();
      const company = document.getElementById('coverCompany').value.trim();
      output.innerHTML = renderCoverTemplate(parseCoverLetter(lastCover), lastCoverMeta, roleTitle, company);
      output.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:#ecfdf5;color:#166534;border:1px solid #86efac;">PDF downloaded.</div>');
    };
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastCover) {
        output.innerHTML = '<div style=\"color:#dc2626;\">No cover letter to save. Please generate first.</div>';
        return;
      }
      const roleTitle = document.getElementById('coverJobTitle').value.trim();
      const company = document.getElementById('coverCompany').value.trim();
      const parsed = parseCoverLetter(lastCover);
      const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const html = `<!DOCTYPE html><html><body style="font-family:Calibri, Arial, sans-serif;font-size:11pt;line-height:1.55;color:#1f2937;margin:0;"><div style="max-width:780px;margin:0 auto;padding:20px 24px;"><div style="border-bottom:3px solid #8ec7da;padding-bottom:10px;margin-bottom:12px;"><div style="font-size:22pt;font-weight:800;color:#0e6e98;">${escapeHtml(lastCoverMeta.name || 'Candidate')}</div><div style="font-size:10pt;color:#64748b;">${escapeHtml([lastCoverMeta.phone, lastCoverMeta.email].filter(Boolean).join('  |  '))}</div><div style="font-size:9.5pt;color:#64748b;margin-top:6px;">${escapeHtml(today)}</div></div><div style="font-size:10pt;color:#334155;margin-bottom:10px;"><strong>Role:</strong> ${escapeHtml(roleTitle || 'Target Role')}<br><strong>Company:</strong> ${escapeHtml(company || 'Target Company')}</div><p style="margin:0 0 10px 0;font-weight:700;">${escapeHtml(parsed.greeting)}</p>${parsed.paragraphs.map((p) => `<p style="margin:0 0 12px 0;">${escapeHtml(p)}</p>`).join('')}<p style="margin:12px 0 0 0;">${escapeHtml(parsed.closing)}<br><strong>${escapeHtml(parsed.signature || lastCoverMeta.name || '')}</strong></p></div></body></html>`;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tailored-cover-letter.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      output.innerHTML = renderCoverTemplate(parsed, lastCoverMeta, roleTitle, company);
      output.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:#ecfdf5;color:#166534;border:1px solid #86efac;">Word document downloaded.</div>');
    };
  }

  clearFieldsBtn?.addEventListener('click', function () {
    const jobTitle = document.getElementById('coverJobTitle');
    const company = document.getElementById('coverCompany');
    const resume = document.getElementById('coverResume');
    const jobDescription = document.getElementById('coverJobDescription');

    if (jobTitle) jobTitle.value = '';
    if (company) company.value = '';
    if (resume) resume.value = '';
    if (jobDescription) jobDescription.value = '';
    if (resumeUploadInput) resumeUploadInput.value = '';

    if (resumeUploadMessage) {
      resumeUploadMessage.textContent = '';
      resumeUploadMessage.style.color = '#64748b';
    }

    lastCover = '';
    lastCoverMeta = { name: '', phone: '', email: '' };
    output.innerHTML = '<div style="color:#166534;background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:10px 12px;">Fields cleared. Add new details to generate another cover letter.</div>';
  });
});
