// Resume Optimizer logic with Resume Generator template parity.

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

  const BLANK_LAYOUT_ID = 'blank-template';
  const THEMES = [
    {
      id: 'forest-ribbon',
      name: 'Forest Ribbon',
      layoutType: 'forest',
      primary: '#0f4a47',
      accent: '#7aa3a0',
      sidebarBg: '#f5f7f8',
      headerText: '#ffffff',
      headingText: '#0f4a47',
      font: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif"
    },
    {
      id: 'gold-sidebar',
      name: 'Golden Sidebar',
      layoutType: 'gold',
      primary: '#7f6500',
      accent: '#b08f0e',
      sidebarBg: '#7f6500',
      headerText: '#111827',
      headingText: '#7f6500',
      font: "'Arial Narrow', Arial, sans-serif"
    },
    {
      id: 'slate-modern',
      name: 'Slate Modern',
      layoutType: 'slate',
      primary: '#1e3a56',
      accent: '#4f83a9',
      sidebarBg: '#eef4f9',
      headerText: '#ffffff',
      headingText: '#1e3a56',
      font: "'Verdana', 'Segoe UI', sans-serif"
    },
    {
      id: 'copper-clean',
      name: 'Copper Clean',
      layoutType: 'forest',
      primary: '#8a3f1f',
      accent: '#d18f63',
      sidebarBg: '#fff7f2',
      headerText: '#ffffff',
      headingText: '#8a3f1f',
      font: "'Georgia', 'Times New Roman', serif"
    },
    {
      id: 'midnight-column',
      name: 'Midnight Column',
      layoutType: 'gold',
      primary: '#172554',
      accent: '#60a5fa',
      sidebarBg: '#172554',
      headerText: '#ffffff',
      headingText: '#172554',
      font: "'Gill Sans', 'Segoe UI', sans-serif"
    },
    {
      id: 'sage-editorial',
      name: 'Sage Editorial',
      layoutType: 'slate',
      primary: '#31524a',
      accent: '#86b4a3',
      sidebarBg: '#f1f7f4',
      headerText: '#ffffff',
      headingText: '#31524a',
      font: "'Palatino Linotype', 'Book Antiqua', serif"
    },
    {
      id: 'berry-executive',
      name: 'Berry Executive',
      layoutType: 'forest',
      primary: '#6b1f3a',
      accent: '#d97b9c',
      sidebarBg: '#fcf4f7',
      headerText: '#ffffff',
      headingText: '#6b1f3a',
      font: "'Avenir Next', 'Segoe UI', sans-serif"
    },
    {
      id: 'onyx-portfolio',
      name: 'Onyx Portfolio',
      layoutType: 'gold',
      primary: '#111827',
      accent: '#f59e0b',
      sidebarBg: '#111827',
      headerText: '#ffffff',
      headingText: '#111827',
      font: "'Helvetica Neue', Arial, sans-serif"
    },
    {
      id: 'ocean-balance',
      name: 'Ocean Balance',
      layoutType: 'slate',
      primary: '#0f4c5c',
      accent: '#59b3c3',
      sidebarBg: '#eef9fb',
      headerText: '#ffffff',
      headingText: '#0f4c5c',
      font: "'Optima', 'Segoe UI', sans-serif"
    }
  ];

  let lastRawResume = '';
  let lastStructuredResume = null;

  function escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeBulletText(text) {
    return String(text || '').replace(/^[\s\-\u2022\*]+/, '').replace(/\s+/g, ' ').trim();
  }

  function splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: 'Professional', rest: 'Candidate' };
    return { first: parts[0], rest: parts.slice(1).join(' ') };
  }

  function sentenceBullets(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+/)
      .map((line) => normalizeBulletText(line))
      .filter(Boolean);
  }

  function renderBulletListHtml(items, fontSize, color, marginBottom) {
    return (items || [])
      .map((item) => normalizeBulletText(item))
      .filter(Boolean)
      .map((item) => `
      <div style="display:flex;align-items:flex-start;gap:10px;font-size:${fontSize};line-height:1.6;color:${color};margin-bottom:${marginBottom};font-weight:400;">
        <span style="font-weight:600;line-height:1.2;">•</span>
        <span style="font-weight:400;flex:1;">${escapeHtml(item)}</span>
      </div>
    `)
      .join('');
  }

  function renderSectionHeading(label, theme, fontSize, extraStyles) {
    return `<div style="font-size:${fontSize};font-weight:800;letter-spacing:0.04em;color:${theme.headingText};margin-bottom:10px;${extraStyles || ''}">${label}</div>`;
  }

  function buildPhotoMarkup() {
    return '';
  }

  function renderTemplateForest(model, theme) {
    const displayName = model.displayName || model.fullName;
    const name = splitName(displayName);
    const profileBullets = sentenceBullets(model.profile);
    const photoMarkup = buildPhotoMarkup();
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:${theme.primary};padding:24px 28px;color:${theme.headerText};display:flex;gap:18px;align-items:center;">
          ${photoMarkup ? `<div style="flex:0 0 auto;">${photoMarkup}</div>` : ''}
          <div style="flex:1;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;letter-spacing:0.03em;">${escapeHtml((name.first + ' ' + name.rest).trim())}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;opacity:0.92;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="padding:24px 20px;background:${theme.sidebarBg};border-right:1px solid #e5e7eb;">
            ${renderSectionHeading('CONTACT', theme, '15px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '12pt', '#1f2937', '6px')}
            ${renderSectionHeading('CERTIFICATIONS', theme, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px 28px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#374151', '8px')}
            <hr style="border:none;border-top:1px solid #d1d5db;margin:18px 0;" />
            ${renderSectionHeading('EXPERIENCE', theme, '16px')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(exp.title || exp.heading || '')}</div>
                ${exp.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(exp.company)}</div>` : ''}
                ${renderBulletListHtml(exp.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin-top:14px;')}
            ${renderBulletListHtml(model.education || [], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateGold(model, theme) {
    const displayName = model.displayName || model.fullName;
    const name = splitName(displayName);
    const profileBullets = sentenceBullets(model.profile);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:24px 20px;color:#fff;min-height:100%;">
            ${renderSectionHeading('CONTACT', { ...theme, headingText: '#ffffff' }, '15px')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', { ...theme, headingText: '#ffffff' }, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 8), '12pt', '#ffffff', '6px')}
            ${renderSectionHeading('EDUCATION', { ...theme, headingText: '#ffffff' }, '15px', 'margin-top:22px;')}
            ${renderBulletListHtml(model.education || [], '12pt', '#ffffff', '6px')}
          </aside>
          <section style="padding:26px 28px;">
            <div style="font-size:38px;line-height:1.05;font-weight:800;color:#111827;">${escapeHtml(name.first)}<span style="font-weight:500;">${escapeHtml(name.rest ? ' ' + name.rest : '')}</span></div>
            <div style="font-size:18px;color:#4b5563;font-weight:600;margin:8px 0 18px 0;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
            ${renderSectionHeading('PROFILE', theme, '16px')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#4b5563', '8px')}
            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin-top:18px;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(exp.title || exp.heading || '')}</div>
                ${exp.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(exp.company)}</div>` : ''}
                ${renderBulletListHtml(exp.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `).join('')}
            ${renderSectionHeading('CERTIFICATIONS', theme, '16px', 'margin-top:14px;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateSlate(model, theme) {
    const displayName = model.displayName || model.fullName;
    const profileBullets = sentenceBullets(model.profile);
    return `
      <div style="background:#fff;border:1px solid #d1d5db;border-radius:14px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,0.08);font-family:${theme.font};">
        <div style="background:linear-gradient(110deg, ${theme.primary}, ${theme.accent});padding:24px 28px;color:${theme.headerText};display:flex;align-items:center;gap:18px;">
          <div>
            <div style="font-size:36px;font-weight:800;line-height:1.05;letter-spacing:0.03em;">${escapeHtml(displayName)}</div>
            <div style="font-size:18px;font-weight:600;margin-top:8px;">${escapeHtml(model.targetRole || 'Professional Candidate')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:220px 1fr;">
          <aside style="background:${theme.sidebarBg};padding:24px 20px;border-right:1px solid #d1d5db;">
            ${renderSectionHeading('CONTACT', theme, '15px', 'margin-bottom:8px;')}
            ${(model.contactLines || []).map((line) => `<div style="font-size:13px;line-height:1.6;color:#1f2937;margin-bottom:6px;">${escapeHtml(line)}</div>`).join('')}
            ${renderSectionHeading('SKILLS', theme, '15px', 'margin:22px 0 8px 0;')}
            ${renderBulletListHtml((model.skills || []).slice(0, 9), '12pt', '#1f2937', '6px')}
          </aside>
          <section style="padding:24px 28px;">
            ${renderSectionHeading('PROFILE', theme, '16px', 'margin-bottom:8px;')}
            ${renderBulletListHtml(profileBullets.length ? profileBullets : [model.profile], '12pt', '#374151', '8px')}
            ${renderSectionHeading('EXPERIENCE', theme, '16px', 'margin:18px 0 8px 0;')}
            ${model.experiences.map((exp) => `
              <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:2px;">${escapeHtml(exp.title || exp.heading || '')}</div>
                ${exp.company ? `<div style="font-size:13px;font-weight:400;color:#6b7280;margin-bottom:4px;">${escapeHtml(exp.company)}</div>` : ''}
                ${renderBulletListHtml(exp.bullets || [], '12pt', '#374151', '6px')}
              </div>
            `).join('')}
            ${renderSectionHeading('EDUCATION', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderBulletListHtml(model.education || [], '12pt', '#374151', '6px')}
            ${renderSectionHeading('AWARDS', theme, '16px', 'margin:18px 0 8px 0;')}
            ${renderBulletListHtml(model.awards.length ? model.awards : ['N/A'], '12pt', '#374151', '6px')}
          </section>
        </div>
      </div>
    `;
  }

  function renderTemplateBlank(model) {
    const renderBulletList = (items) => (items || []).map((item) => `<div style="margin-bottom:6px;font-size:12pt;">• ${escapeHtml(item)}</div>`).join('');
    return `
      <div style="font-family:Arial, sans-serif; max-width:850px; margin:0 auto; padding:40px; background:#fff; color:#000; line-height:1.6;">
        <div style="text-align:center; margin-bottom:24px; border-bottom:2px solid #000; padding-bottom:16px;">
          <div style="font-size:28px; font-weight:bold; margin-bottom:4px;">${escapeHtml(model.displayName || 'Professional')}</div>
          <div style="font-size:14px; color:#333;">${(model.contactLines || []).map(escapeHtml).join(' • ')}</div>
          ${model.targetRole ? `<div style="font-size:16px; font-weight:600; margin-top:8px;">${escapeHtml(model.targetRole)}</div>` : ''}
        </div>
        ${model.profile ? `<div style="margin-bottom:20px;"><div style="font-weight:bold; margin-bottom:8px;">PROFILE</div><div style="font-size:14px;">${escapeHtml(model.profile)}</div></div>` : ''}
        ${model.experiences && model.experiences.length ? `<div style="margin-bottom:20px;"><div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">EXPERIENCE</div>${model.experiences.map((exp) => `<div style="margin-bottom:12px;"><div style="font-weight:600;">${escapeHtml(exp.title || '')}</div>${exp.company ? `<div style="font-size:13px; color:#555;">${escapeHtml(exp.company)}</div>` : ''}${renderBulletList((exp.bullets || []).slice(0, 3))}</div>`).join('')}</div>` : ''}
        ${model.education && model.education.length ? `<div style="margin-bottom:20px;"><div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">EDUCATION</div>${renderBulletList((model.education || []).slice(0, 5))}</div>` : ''}
        ${model.skills && model.skills.length ? `<div style="margin-bottom:20px;"><div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #ccc; padding-bottom:4px;">SKILLS</div><div style="font-size:14px;">${escapeHtml((model.skills || []).join(' • '))}</div></div>` : ''}
      </div>
    `;
  }

  function renderResumeTemplate(model) {
    if (model.theme?.id === BLANK_LAYOUT_ID) return renderTemplateBlank(model);
    const theme = model.theme || THEMES[0];
    if (theme.layoutType === 'gold') return renderTemplateGold(model, theme);
    if (theme.layoutType === 'slate') return renderTemplateSlate(model, theme);
    return renderTemplateForest(model, theme);
  }

  function statusBanner(message, ok) {
    output.innerHTML = `<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:${ok ? '#ecfdf5' : '#fef2f2'};color:${ok ? '#166534' : '#991b1b'};border:1px solid ${ok ? '#86efac' : '#fecaca'};">${escapeHtml(message)}</div>`;
  }

  function removeImprovementsSection(text) {
    const input = String(text || '').replace(/\r/g, '');
    const stripped = input.replace(
      /(?:^|\n)\s*IMPROVEMENTS\s*:?[ \t]*\n[\s\S]*?(?=\n\s*(?:PROFILE|SUMMARY|EXPERIENCE|EDUCATION|SKILLS|AWARDS|CERTIFICATION|CERTIFICATIONS|PROJECTS)\b[ \t]*:?\s*\n|$)/i,
      '\n'
    );
    return stripped.replace(/\n{3,}/g, '\n\n').trim();
  }

  function extractContactInfo(baseResumeText) {
    const text = String(baseResumeText || '');
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
    const linkedInMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+/i);
    return {
      fullName: text.split(/\n/).map((line) => line.trim()).find((line) => line && !/@/.test(line) && !/\d{3}[-.)\s]?\d{3}/.test(line)) || '',
      phone: phoneMatch ? phoneMatch[0] : '',
      email: emailMatch ? emailMatch[0] : '',
      linkedin: linkedInMatch ? linkedInMatch[0] : ''
    };
  }

  function parseResume(rawText, fallbackContact) {
    const lines = String(rawText || '').replace(/\r/g, '').split('\n').map((line) => line.trimRight());
    const headings = {
      PROFILE: -1,
      SUMMARY: -1,
      EXPERIENCE: -1,
      EDUCATION: -1,
      SKILLS: -1,
      AWARDS: -1,
      CERTIFICATION: -1,
      CERTIFICATIONS: -1,
      PROJECTS: -1,
      IMPROVEMENTS: -1
    };

    lines.forEach((line, idx) => {
      const key = line.replace(/[:\-]/g, '').trim().toUpperCase();
      if (Object.prototype.hasOwnProperty.call(headings, key)) headings[key] = idx;
    });

    const allHeadingPositions = Object.values(headings).filter((idx) => idx >= 0).sort((a, b) => a - b);
    const firstHeading = allHeadingPositions.length ? allHeadingPositions[0] : lines.length;
    const headerLines = lines.slice(0, firstHeading).map((line) => line.trim()).filter(Boolean);

    const fullName = normalizeBulletText(headerLines[0] || fallbackContact.fullName || 'Professional Candidate') || 'Professional Candidate';
    const contactLines = headerLines.slice(1, 4).map((line) => normalizeBulletText(line)).filter(Boolean);
    if (!contactLines.length) {
      [fallbackContact.phone, fallbackContact.email, fallbackContact.linkedin].filter(Boolean).forEach((entry) => contactLines.push(entry));
    }

    function sectionLines(startKey, altKey) {
      const start = headings[startKey] >= 0 ? headings[startKey] : (altKey && headings[altKey] >= 0 ? headings[altKey] : -1);
      if (start < 0) return [];
      const next = allHeadingPositions.find((idx) => idx > start);
      const end = typeof next === 'number' ? next : lines.length;
      return lines.slice(start + 1, end).map((line) => line.trim()).filter(Boolean);
    }

    const profileLines = sectionLines('PROFILE', 'SUMMARY');
    const profile = profileLines.join(' ') || 'Results-driven professional with relevant experience and a strong record of delivering measurable outcomes.';

    const skills = sectionLines('SKILLS')
      .join(',')
      .split(/[,|]/)
      .map((s) => normalizeBulletText(s))
      .filter(Boolean)
      .slice(0, 20);

    const education = sectionLines('EDUCATION').map((line) => normalizeBulletText(line)).filter(Boolean);
    const certs = sectionLines('CERTIFICATIONS', 'CERTIFICATION').map((line) => normalizeBulletText(line)).filter(Boolean);
    const awards = sectionLines('AWARDS').map((line) => normalizeBulletText(line)).filter(Boolean);

    const expLines = sectionLines('EXPERIENCE');
    const experiences = [];
    let current = null;
    expLines.forEach((line) => {
      const clean = normalizeBulletText(line);
      if (!clean) return;
      const isBullet = /^[-*\u2022]/.test(line.trim());
      if (!isBullet && (!current || /,|\s-\s|\|/.test(clean))) {
        current = { title: clean, company: '', bullets: [] };
        experiences.push(current);
        return;
      }
      if (!current) {
        current = { title: 'Professional Experience', company: '', bullets: [] };
        experiences.push(current);
      }
      current.bullets.push(clean);
    });

    if (!experiences.length) {
      experiences.push({
        title: 'Professional Experience',
        company: '',
        bullets: [
          'Tailored core achievements to align with the target role requirements.',
          'Highlighted impact-driven accomplishments and relevant skills.'
        ]
      });
    }

    return {
      fullName,
      contactLines,
      profile,
      experiences,
      education: education.length ? education : ['Education details available upon request'],
      skills,
      awards: [...new Set([...(certs || []), ...(awards || [])])]
    };
  }

  function buildResumeModel(structured, targetRole, selectedThemeId) {
    const theme = selectedThemeId === BLANK_LAYOUT_ID
      ? {
          id: BLANK_LAYOUT_ID,
          name: 'Blank Template',
          layoutType: 'blank',
          primary: '#000000',
          accent: '#666666',
          sidebarBg: '#ffffff',
          headerText: '#000000',
          headingText: '#000000',
          font: 'Arial, sans-serif'
        }
      : (THEMES.find((item) => item.id === selectedThemeId) || THEMES[0]);

    return {
      ...structured,
      displayName: structured.fullName,
      targetRole,
      theme
    };
  }

  function getSelectedThemeId() {
    const selected = String(templateSelect?.value || BLANK_LAYOUT_ID);
    if (selected === BLANK_LAYOUT_ID) return BLANK_LAYOUT_ID;
    return THEMES.some((item) => item.id === selected) ? selected : BLANK_LAYOUT_ID;
  }

  function buildResumePdfDoc(model) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const theme = model.theme;

    const leftX = 12;
    const leftW = 56;
    const rightX = 74;
    const rightW = 124;

    if (theme.id === BLANK_LAYOUT_ID) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(model.displayName || 'Professional Candidate', 10, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text((model.contactLines || []).join(' | '), 10, 28);
      doc.setFontSize(12);
      let y = 38;
      doc.setFont('helvetica', 'bold');
      doc.text('PROFILE', 10, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.splitTextToSize(model.profile || '', 190).forEach((line) => {
        doc.text(line, 10, y);
        y += 5;
      });
      return doc;
    }

    doc.setFillColor(
      parseInt(theme.sidebarBg.slice(1, 3), 16),
      parseInt(theme.sidebarBg.slice(3, 5), 16),
      parseInt(theme.sidebarBg.slice(5, 7), 16)
    );
    doc.rect(10, 10, leftW + 4, 277, 'F');

    doc.setFillColor(
      parseInt(theme.primary.slice(1, 3), 16),
      parseInt(theme.primary.slice(3, 5), 16),
      parseInt(theme.primary.slice(5, 7), 16)
    );
    doc.rect(70, 10, 130, 24, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text((model.displayName || '').slice(0, 40), rightX, 21);

    doc.setFontSize(10);
    doc.text((model.targetRole || 'Professional Candidate').slice(0, 60), rightX, 28);

    let leftY = 42;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTACT', leftX, leftY);
    leftY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    (model.contactLines || []).forEach((line) => {
      const wrapped = doc.splitTextToSize(line, leftW - 4);
      doc.text(wrapped, leftX, leftY);
      leftY += wrapped.length * 4.2;
    });

    leftY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('KEY SKILLS', leftX, leftY);
    leftY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    (model.skills || []).slice(0, 10).forEach((skill) => {
      const clean = normalizeBulletText(skill);
      if (!clean) return;
      const wrapped = doc.splitTextToSize(`• ${clean}`, leftW - 4);
      doc.text(wrapped, leftX, leftY);
      leftY += wrapped.length * 4.2;
    });

    let rightY = 42;
    function drawTitle(title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(
        parseInt(theme.primary.slice(1, 3), 16),
        parseInt(theme.primary.slice(3, 5), 16),
        parseInt(theme.primary.slice(5, 7), 16)
      );
      doc.text(title, rightX, rightY);
      rightY += 5;
      doc.setTextColor(31, 41, 55);
    }

    drawTitle('PROFILE');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    sentenceBullets(model.profile).forEach((line) => {
      const clean = normalizeBulletText(line);
      if (!clean) return;
      const wrapped = doc.splitTextToSize(`• ${clean}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });
    rightY += 3;

    drawTitle('PROFESSIONAL EXPERIENCE');
    (model.experiences || []).forEach((exp) => {
      if (rightY > 272) {
        doc.addPage();
        rightY = 16;
      }
      const expTitle = exp.title || exp.heading || '';
      if (expTitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        const wrapped = doc.splitTextToSize(expTitle, rightW);
        doc.text(wrapped, rightX, rightY);
        rightY += wrapped.length * 4.2;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      (exp.bullets || []).forEach((bullet) => {
        const clean = normalizeBulletText(bullet);
        if (!clean) return;
        const wrapped = doc.splitTextToSize(`• ${clean}`, rightW);
        doc.text(wrapped, rightX, rightY);
        rightY += wrapped.length * 4.2;
      });
      rightY += 2;
    });

    drawTitle('EDUCATION');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    (model.education || []).forEach((line) => {
      const clean = normalizeBulletText(line);
      if (!clean) return;
      const wrapped = doc.splitTextToSize(`• ${clean}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    rightY += 2;
    drawTitle('CERTIFICATIONS');
    (model.awards.length ? model.awards : ['N/A']).forEach((line) => {
      const clean = normalizeBulletText(line);
      if (!clean) return;
      const wrapped = doc.splitTextToSize(`• ${clean}`, rightW);
      doc.text(wrapped, rightX, rightY);
      rightY += wrapped.length * 4.2;
    });

    return doc;
  }

  async function buildTemplatePdfDoc(model) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // jsPDF.html gives closest parity with the rendered template card.
    if (typeof doc.html !== 'function') {
      return buildResumePdfDoc(model);
    }

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '860px';
    host.style.padding = '0';
    host.style.margin = '0';
    host.style.background = '#ffffff';
    host.innerHTML = renderResumeTemplate(model);
    document.body.appendChild(host);

    try {
      await doc.html(host, {
        margin: [20, 20, 20, 20],
        autoPaging: 'text',
        width: 555,
        windowWidth: 860,
        html2canvas: {
          backgroundColor: '#ffffff',
          scale: 0.72,
          useCORS: true
        }
      });
      return doc;
    } finally {
      document.body.removeChild(host);
    }
  }

  async function createResumePdfBlob(model) {
    const doc = await buildTemplatePdfDoc(model);
    return doc.output('blob');
  }

  function createResumeWordBlob(model) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:${model.theme.font};margin:0;color:#111827;">${renderResumeTemplate(model)}</body></html>`;
    return new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  }

  function hydrateTemplateSelector() {
    if (!templateSelect) return;
    const options = [
      { id: BLANK_LAYOUT_ID, name: 'Blank Template' },
      ...THEMES.map((theme) => ({ id: theme.id, name: theme.name }))
    ];
    templateSelect.innerHTML = options
      .map((item) => `<option value="${item.id}">${item.name}</option>`)
      .join('');
    templateSelect.value = BLANK_LAYOUT_ID;
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

  templateSelect?.addEventListener('change', function () {
    if (!lastStructuredResume) return;
    lastStructuredResume.theme = buildResumeModel({}, '', getSelectedThemeId()).theme;
    output.innerHTML = renderResumeTemplate(lastStructuredResume);
  });

  resumeUploadInput?.addEventListener('change', async function (event) {
    const file = event.target.files?.[0];
    await loadResumeFileIntoField(file, document.getElementById('resumeBase'), resumeUploadMessage);
  });

  rewriteBtn?.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitle').value.trim();
    const company = document.getElementById('resumeCompany').value.trim();
    const baseResume = document.getElementById('resumeBase').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescription').value.trim();

    if (!jobTitle || !baseResume || !fullJobDescription) {
      statusBanner('Please add the job title, your resume, and the full job description.', false);
      return;
    }

    output.innerHTML = '<div style="color:#2563eb;">Rewriting resume...</div>';

    try {
      const selectedThemeId = getSelectedThemeId();
      const selectedThemeName = selectedThemeId === BLANK_LAYOUT_ID
        ? 'Blank Template'
        : ((THEMES.find((item) => item.id === selectedThemeId) || THEMES[0]).name);

      const jobDescription = [
        `Job Title: ${jobTitle}`,
        company ? `Company: ${company}` : '',
        `Resume Template: ${selectedThemeName}`,
        '',
        'Full Job Description:',
        fullJobDescription
      ].filter(Boolean).join('\n');

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
        statusBanner((data && data.error) || 'Failed to rewrite resume.', false);
        return;
      }

      const cleaned = removeImprovementsSection(String(data.result || ''));
      lastRawResume = cleaned;
      const parsed = parseResume(cleaned, extractContactInfo(baseResume));
      lastStructuredResume = buildResumeModel(parsed, jobTitle, selectedThemeId);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      output.insertAdjacentHTML(
        'afterbegin',
        `<div style="margin-bottom:10px;font-weight:700;color:#334155;">Template: ${escapeHtml(lastStructuredResume.theme.name || 'Blank Template')}</div>`
      );
    } catch (_) {
      statusBanner('Error rewriting resume.', false);
    }
  });

  savePdfBtn?.addEventListener('click', async function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        statusBanner('No resume to save. Please rewrite first.', false);
        return;
      }
      const doc = await buildTemplatePdfDoc(lastStructuredResume);
      doc.save('tailored-resume.pdf');
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('PDF downloaded.', true);
    } catch (error) {
      statusBanner(error.message || 'Could not generate PDF.', false);
    }
  });

  saveWordBtn?.addEventListener('click', function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        statusBanner('No resume to save. Please rewrite first.', false);
        return;
      }
      const blob = createResumeWordBlob(lastStructuredResume);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'tailored-resume.doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      statusBanner('Word document downloaded.', true);
    } catch (_) {
      statusBanner('Could not generate Word document.', false);
    }
  });

  sendEmailBtn?.addEventListener('click', async function () {
    try {
      if (!lastStructuredResume || !lastRawResume) {
        statusBanner('No resume to send. Please rewrite first.', false);
        return;
      }

      sendEmailBtn.disabled = true;
      sendEmailBtn.textContent = 'Sending...';

      const htmlContent = `<!DOCTYPE html><html><body style="font-family:${lastStructuredResume.theme.font};margin:0;color:#111827;">${renderResumeTemplate(lastStructuredResume)}</body></html>`;
      const pdfBlob = await createResumePdfBlob(lastStructuredResume);
      const wordBlob = createResumeWordBlob(lastStructuredResume);
      const result = await window.sendDocumentToAccountEmail({
        feature: 'Resume',
        filename: 'tailored-resume',
        htmlContent,
        textContent: lastRawResume,
        attachments: [
          { filename: 'tailored-resume.pdf', blob: pdfBlob, contentType: 'application/pdf' },
          { filename: 'tailored-resume.doc', blob: wordBlob, contentType: 'application/msword' }
        ]
      });

      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send to Email';

      output.innerHTML = renderResumeTemplate(lastStructuredResume);
      if (result.ok) {
        statusBanner('Sent! Check your inbox — if you do not see it within a minute, check spam or junk.', true);
      } else {
        statusBanner(result.error || 'Could not send resume email.', false);
      }
    } catch (_) {
      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send to Email';
      statusBanner('Could not send resume email.', false);
    }
  });

  clearFieldsBtn?.addEventListener('click', function () {
    const jobTitle = document.getElementById('resumeJobTitle');
    const company = document.getElementById('resumeCompany');
    const baseResume = document.getElementById('resumeBase');
    const jobDescription = document.getElementById('resumeJobDescription');

    if (jobTitle) jobTitle.value = '';
    if (company) company.value = '';
    if (baseResume) baseResume.value = '';
    if (jobDescription) jobDescription.value = '';
    if (templateSelect) templateSelect.value = BLANK_LAYOUT_ID;
    if (resumeUploadInput) resumeUploadInput.value = '';

    if (resumeUploadMessage) {
      resumeUploadMessage.textContent = '';
      resumeUploadMessage.style.color = '#64748b';
    }

    lastRawResume = '';
    lastStructuredResume = null;
    output.innerHTML = '';
    statusBanner('Fields cleared. Add new details to optimize another resume.', true);
  });

  hydrateTemplateSelector();
});
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
