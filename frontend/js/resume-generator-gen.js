document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const savePdfBtn = document.getElementById('saveResumePdfBtnGen');
  const saveWordBtn = document.getElementById('saveResumeWordBtnGen');
  const output = document.getElementById('resumeOutputGen');
  const resumeUploadInput = document.getElementById('resumeBaseUploadGen');
  const resumeUploadMessage = document.getElementById('resumeBaseUploadMessageGen');

  let lastRawResume = '';
  let lastStructuredResume = null;

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
    const linkedin = (text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i) || [])[0] || '';

    let fullName = '';
    for (const line of lines.slice(0, 6)) {
      if (/^[A-Za-z][A-Za-z\s'.-]{2,}$/.test(line) && line.split(/\s+/).length <= 5) {
        fullName = line;
        break;
      }
    }

    const cityStateLine = lines.find((line) => /,\s*[A-Z]{2}\b/.test(line)) || '';
    return {
      fullName,
      email,
      phone,
      location: cityStateLine,
      linkedin
    };
  }

  function parseResume(rawText, fallbackFromBase) {
    const text = String(rawText || '').replace(/\r/g, '');
    const lines = text.split('\n').map((line) => line.trimRight());

    const structured = {
      fullName: fallbackFromBase.fullName || 'Candidate Name',
      contactLines: [fallbackFromBase.phone, fallbackFromBase.email, fallbackFromBase.location, fallbackFromBase.linkedin].filter(Boolean),
      profile: '',
      experiences: [],
      education: [],
      skills: [],
      awards: []
    };

    const sectionIndex = {
      PROFILE: -1,
      EXPERIENCE: -1,
      EDUCATION: -1,
      SKILLS: -1,
      AWARDS: -1,
      IMPROVEMENTS: -1
    };

    lines.forEach((line, idx) => {
      const key = line.replace(/[:\-]/g, '').trim().toUpperCase();
      if (Object.prototype.hasOwnProperty.call(sectionIndex, key)) {
        sectionIndex[key] = idx;
      }
    });

    if (lines[0] && /^[A-Za-z][A-Za-z\s'.-]{2,}$/.test(lines[0]) && lines[0].split(/\s+/).length <= 5) {
      structured.fullName = lines[0].trim();
    }

    function between(startIdx, endIdx) {
      const start = startIdx >= 0 ? startIdx + 1 : -1;
      if (start < 0) return [];
      const end = endIdx >= 0 ? endIdx : lines.length;
      return lines.slice(start, end).map((line) => line.trim()).filter(Boolean);
    }

    const ordered = Object.entries(sectionIndex)
      .filter(([, idx]) => idx >= 0)
      .sort((a, b) => a[1] - b[1]);

    const nextSectionStart = (name) => {
      const current = ordered.find((item) => item[0] === name);
      if (!current) return -1;
      const currentPos = ordered.indexOf(current);
      const next = ordered[currentPos + 1];
      return next ? next[1] : -1;
    };

    const profileLines = between(sectionIndex.PROFILE, nextSectionStart('PROFILE'));
    structured.profile = profileLines.join(' ');

    const experienceLines = between(sectionIndex.EXPERIENCE, nextSectionStart('EXPERIENCE'));
    let current = null;
    experienceLines.forEach((line) => {
      const normalized = line.replace(/^[-*]\s*/, '').trim();
      const isNewRole = /\b(20\d{2}|19\d{2})\b/.test(normalized) || normalized.includes('|') || normalized.split(',').length >= 2;

      if (isNewRole && normalized.length > 8) {
        if (current) structured.experiences.push(current);
        current = { heading: normalized, bullets: [] };
        return;
      }

      if (!current) {
        current = { heading: 'Experience', bullets: [] };
      }
      current.bullets.push(normalized);
    });
    if (current) structured.experiences.push(current);

    structured.education = between(sectionIndex.EDUCATION, nextSectionStart('EDUCATION'));

    const skillsLines = between(sectionIndex.SKILLS, nextSectionStart('SKILLS'));
    structured.skills = skillsLines
      .join(', ')
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    structured.awards = between(sectionIndex.AWARDS, nextSectionStart('AWARDS'));

    if (!structured.profile) {
      structured.profile = 'Results-driven professional with relevant experience and a strong record of delivering measurable outcomes.';
    }

    if (!structured.experiences.length) {
      structured.experiences = [{
        heading: 'Professional Experience',
        bullets: [
          'Tailored core achievements to align with the target role requirements.',
          'Highlighted impact-driven accomplishments and relevant skills.'
        ]
      }];
    }

    if (!structured.education.length) {
      structured.education = ['Education details available upon request'];
    }

    if (!structured.skills.length) {
      structured.skills = ['Communication', 'Collaboration', 'Problem Solving'];
    }

    return structured;
  }

  function renderResumeTemplate(model) {
    const experienceHtml = model.experiences.map((exp) => `
      <div style="margin-bottom:14px;">
        <div style="font-weight:800;color:#0e6e98;font-size:18px;line-height:1.2;">${escapeHtml(exp.heading)}</div>
        ${(exp.bullets || []).map((b) => `<div style="font-size:16px;line-height:1.45;color:#1f2937;">${escapeHtml(b)}</div>`).join('')}
      </div>
    `).join('');

    const educationHtml = model.education.map((line) => `<div style="font-size:16px;line-height:1.45;color:#1f2937;">${escapeHtml(line)}</div>`).join('');
    const skillsHtml = `<div style="font-size:16px;line-height:1.45;color:#1f2937;">${escapeHtml(model.skills.join(', '))}</div>`;
    const awardsHtml = model.awards.length
      ? model.awards.map((line) => `<div style="font-size:16px;line-height:1.45;color:#1f2937;">${escapeHtml(line)}</div>`).join('')
      : '<div style="font-size:16px;line-height:1.45;color:#1f2937;">N/A</div>';

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;box-shadow:0 8px 28px rgba(15,23,42,0.08);">
        <div style="font-family:Arial, Helvetica, sans-serif;max-width:900px;margin:0 auto;color:#0f172a;">
          <h2 style="margin:0 0 6px 0;font-size:54px;letter-spacing:1px;color:#0e6e98;line-height:1;">${escapeHtml((model.fullName || '').toUpperCase())}</h2>
          <div style="height:5px;background:#8ec7da;margin:0 0 18px 0;"></div>
          <div style="display:grid;grid-template-columns:240px 1fr;gap:24px;">
            <aside>
              ${(model.contactLines || []).map((line) => `<div style="font-size:14px;line-height:1.45;color:#4b5563;margin-bottom:2px;">${escapeHtml(line)}</div>`).join('')}
              <div style="height:4px;background:#8ec7da;margin-top:16px;"></div>
            </aside>
            <section>
              <div style="font-weight:900;color:#0e6e98;font-size:32px;line-height:1;margin-bottom:6px;">PROFILE</div>
              <div style="font-size:18px;line-height:1.45;color:#1f2937;margin-bottom:14px;">${escapeHtml(model.profile)}</div>

              <div style="font-weight:900;color:#0e6e98;font-size:32px;line-height:1;margin:12px 0 6px 0;">EXPERIENCE</div>
              ${experienceHtml}

              <div style="font-weight:900;color:#0e6e98;font-size:32px;line-height:1;margin:12px 0 6px 0;">EDUCATION</div>
              ${educationHtml}

              <div style="font-weight:900;color:#0e6e98;font-size:32px;line-height:1;margin:12px 0 6px 0;">SKILLS</div>
              ${skillsHtml}

              <div style="font-weight:900;color:#0e6e98;font-size:32px;line-height:1;margin:12px 0 6px 0;">AWARDS</div>
              ${awardsHtml}
            </section>
          </div>
        </div>
      </div>
    `;
  }

  function renderError(message) {
    output.innerHTML = `<div style="color:#dc2626;font-size:1.05rem;">${escapeHtml(message)}</div>`;
  }

  function statusBanner(message, ok) {
    output.insertAdjacentHTML(
      'afterbegin',
      `<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:${ok ? '#ecfdf5' : '#fef2f2'};color:${ok ? '#166534' : '#991b1b'};border:1px solid ${ok ? '#86efac' : '#fecaca'};">${escapeHtml(message)}</div>`
    );
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
        const res = await fetch('/api/resume/upload', { method: 'POST', headers, body: formData });
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

  function drawSectionTitle(doc, title, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(14, 110, 152);
    doc.text(title, x, y);
    doc.setTextColor(31, 41, 55);
  }

  function exportResumePdf(model) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const leftX = 12;
    const rightX = 70;
    const leftW = 50;
    const rightW = 128;
    let y = 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(14, 110, 152);
    doc.text((model.fullName || '').toUpperCase(), leftX, y);
    y += 3;
    doc.setDrawColor(142, 199, 218);
    doc.setLineWidth(1);
    doc.line(leftX, y + 2, 198, y + 2);

    let leftY = y + 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.setFontSize(9);
    (model.contactLines || []).forEach((line) => {
      const wrapped = doc.splitTextToSize(line, leftW);
      doc.text(wrapped, leftX, leftY);
      leftY += wrapped.length * 4.3;
    });
    doc.setDrawColor(142, 199, 218);
    doc.line(leftX, leftY + 2, leftX + leftW, leftY + 2);

    let rightY = y + 10;
    drawSectionTitle(doc, 'PROFILE', rightX, rightY);
    rightY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    let wrapped = doc.splitTextToSize(model.profile || '', rightW);
    doc.text(wrapped, rightX, rightY);
    rightY += wrapped.length * 4.6 + 3;

    drawSectionTitle(doc, 'EXPERIENCE', rightX, rightY);
    rightY += 5;
    model.experiences.forEach((exp) => {
      if (rightY > 272) {
        doc.addPage();
        rightY = 16;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(14, 110, 152);
      wrapped = doc.splitTextToSize(exp.heading || '', rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.4;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      (exp.bullets || []).forEach((bullet) => {
        const bulletWrapped = doc.splitTextToSize(bullet, rightW);
        doc.text(bulletWrapped, rightX, rightY);
        rightY += bulletWrapped.length * 4.4;
      });
      rightY += 2;
    });

    const sectionBlock = (title, lines, asList) => {
      if (rightY > 272) {
        doc.addPage();
        rightY = 16;
      }
      drawSectionTitle(doc, title, rightX, rightY);
      rightY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(31, 41, 55);
      const valueLines = asList ? [lines.join(', ')] : lines;
      valueLines.forEach((line) => {
        const t = doc.splitTextToSize(line, rightW);
        doc.text(t, rightX, rightY);
        rightY += t.length * 4.4;
      });
      rightY += 2;
    };

    sectionBlock('EDUCATION', model.education, false);
    sectionBlock('SKILLS', model.skills, true);
    sectionBlock('AWARDS', model.awards.length ? model.awards : ['N/A'], false);

    doc.save('tailored-resume.pdf');
  }

  function exportResumeWord(model) {
    const experienceHtml = model.experiences.map((exp) => `
      <div style="margin-bottom:10px;">
        <div style="font-weight:700;color:#0e6e98;font-size:12pt;">${escapeHtml(exp.heading)}</div>
        ${(exp.bullets || []).map((b) => `<div style="font-size:10.5pt;line-height:1.45;">${escapeHtml(b)}</div>`).join('')}
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Calibri, Arial, sans-serif;color:#0f172a;margin:0;">
  <div style="padding:20px 22px;max-width:800px;margin:0 auto;">
    <div style="font-size:30pt;font-weight:800;color:#0e6e98;letter-spacing:1px;line-height:1;">${escapeHtml((model.fullName || '').toUpperCase())}</div>
    <div style="height:3px;background:#8ec7da;margin:8px 0 14px 0;"></div>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:28%;vertical-align:top;padding-right:12px;border-right:1px solid #8ec7da;">
          ${(model.contactLines || []).map((line) => `<div style="font-size:9.5pt;color:#4b5563;line-height:1.4;">${escapeHtml(line)}</div>`).join('')}
        </td>
        <td style="width:72%;vertical-align:top;padding-left:14px;">
          <div style="font-size:13pt;font-weight:800;color:#0e6e98;margin-bottom:4px;">PROFILE</div>
          <div style="font-size:10.5pt;line-height:1.45;margin-bottom:10px;">${escapeHtml(model.profile)}</div>

          <div style="font-size:13pt;font-weight:800;color:#0e6e98;margin-bottom:4px;">EXPERIENCE</div>
          ${experienceHtml}

          <div style="font-size:13pt;font-weight:800;color:#0e6e98;margin-bottom:4px;">EDUCATION</div>
          ${(model.education || []).map((line) => `<div style="font-size:10.5pt;line-height:1.45;">${escapeHtml(line)}</div>`).join('')}

          <div style="font-size:13pt;font-weight:800;color:#0e6e98;margin:8px 0 4px 0;">SKILLS</div>
          <div style="font-size:10.5pt;line-height:1.45;">${escapeHtml((model.skills || []).join(', '))}</div>

          <div style="font-size:13pt;font-weight:800;color:#0e6e98;margin:8px 0 4px 0;">AWARDS</div>
          ${(model.awards.length ? model.awards : ['N/A']).map((line) => `<div style="font-size:10.5pt;line-height:1.45;">${escapeHtml(line)}</div>`).join('')}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tailored-resume.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  resumeUploadInput?.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    await loadResumeFileIntoField(file, document.getElementById('resumeBaseGen'), resumeUploadMessage);
  });

  generateBtn?.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const baseResume = document.getElementById('resumeBaseGen').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescriptionGen').value.trim();

    if (!jobTitle || !company || !baseResume || !fullJobDescription) {
      renderError('Please fill in all fields.');
      return;
    }

    output.innerHTML = '<div style="color:#2563eb;">Generating resume...</div>';

    try {
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}\n\nFull Job Description:\n${fullJobDescription}`;
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume: baseResume })
      });
      const data = await res.json();

      if (!res.ok || !data.result) {
        renderError((data && data.error) || 'Failed to generate resume.');
        return;
      }

      const raw = String(data.result || '').trim();
      lastRawResume = raw;
      lastStructuredResume = parseResume(raw, extractContactInfo(baseResume));
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('Resume generated. Use Save as PDF or Save as Word for a ready-to-upload file.', true);
    } catch (err) {
      renderError('Error generating resume.');
    }
  });

  savePdfBtn?.addEventListener('click', function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to save. Please generate first.');
        return;
      }
      exportResumePdf(lastStructuredResume);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('PDF downloaded.', true);
    } catch (err) {
      renderError(err.message || 'Could not generate PDF.');
    }
  });

  saveWordBtn?.addEventListener('click', function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        renderError('No resume to save. Please generate first.');
        return;
      }
      exportResumeWord(lastStructuredResume);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('Word document downloaded.', true);
    } catch (err) {
      renderError('Could not generate Word document.');
    }
  });
});
