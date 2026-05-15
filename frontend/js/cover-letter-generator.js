// Cover Letter Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveCoverPdfBtn');
  const saveWordBtn = document.getElementById('saveCoverWordBtn');
  const sendEmailBtn = document.getElementById('sendCoverEmailBtn');
  const generateBtn = document.getElementById('generateCoverBtn');
  const clearFieldsBtn = document.getElementById('clearCoverFieldsBtn');
  const output = document.getElementById('coverLetterOutput');
  const resumeUploadInput = document.getElementById('coverResumeUpload');
  const resumeUploadMessage = document.getElementById('coverResumeUploadMessage');
  const billingStatus = document.getElementById('coverBillingStatus');
  const buySingleBtn = document.getElementById('coverBuySingleBtn');
  const buyFiveBtn = document.getElementById('coverBuyFiveBtn');
  const buyTenBtn = document.getElementById('coverBuyTenBtn');
  let lastCover = '';
  let lastCoverMeta = { name: '', phone: '', email: '' };
  let coverCreditStatus = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAuthToken() {
    if (typeof getStoredToken === 'function') {
      const stored = getStoredToken();
      if (stored) return stored;
    }

    return (
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      localStorage.getItem('rr_token') ||
      sessionStorage.getItem('rr_token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('authToken') ||
      ''
    );
  }

  function setBillingButtonsDisabled(disabled) {
    [buySingleBtn, buyFiveBtn, buyTenBtn].forEach((btn) => {
      if (!btn) return;
      btn.disabled = disabled;
    });
  }

  function renderCoverCreditStatus(status) {
    coverCreditStatus = status || null;
    if (!billingStatus) return;

    if (!status) {
      billingStatus.textContent = 'Could not load your document credit status.';
      return;
    }

    if (status.unlimited) {
      billingStatus.textContent = 'Your current plan includes unlimited cover letter generations.';
      setBillingButtonsDisabled(true);
      return;
    }

    const freeLabel = status.freeRemaining > 0 ? '1 free daily generation remaining' : 'Free daily generation already used';
    const creditLabel = `${Number(status.paidCredits || 0)} paid credit${Number(status.paidCredits || 0) === 1 ? '' : 's'} available`;
    billingStatus.textContent = `${freeLabel}. ${creditLabel}.`;
    setBillingButtonsDisabled(false);
  }

  async function loadCoverCreditStatus() {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch('/api/document-credits/status?feature=cover-letter', { headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not load billing status.');
    }
    renderCoverCreditStatus(data.status || null);
    return data.status || null;
  }

  async function startCreditCheckout(bundle) {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    setBillingButtonsDisabled(true);
    try {
      const response = await fetch('/api/document-credits/create-checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bundle,
          returnPath: '/resume-generator.html'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout.');
      }
      window.location.href = data.url;
    } catch (error) {
      output.innerHTML = `<div style="color:#dc2626;">${escapeHtml(error.message || 'Could not start checkout.')}</div>`;
      setBillingButtonsDisabled(false);
    }
  }

  function cleanNameCandidate(line) {
    let raw = String(line || '').trim();
    if (!raw) return '';

    const leadingName = raw.split(',')[0].trim();
    if (!leadingName) return '';

    // Remove non-letter separators while allowing spaces, apostrophes, dots, hyphens, and credential parens.
    raw = leadingName.replace(/[^A-Za-z\s'.\-()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    const words = raw.split(' ').filter(Boolean);
    // Allow up to 8 words to cover hyphenated names, middle names, and short credential tokens.
    if (words.length < 2 || words.length > 8) return '';

    const disallowedTitles = new Set([
      'project manager',
      'program manager',
      'construction engineer',
      'software engineer',
      'data scientist',
      'product manager',
      'business analyst',
      'customer service',
      'professional summary',
      'work experience',
      'education'
    ]);
    if (disallowedTitles.has(raw.toLowerCase())) return '';

    // Basic guard against lines with digits/emails/phones/addresses.
    if (/\d|@|\b(street|avenue|road|blvd|drive|lane|suite)\b/i.test(String(line || ''))) return '';

    // Return the first 1-2 name words in title case (core name, before credentials)
    const coreWords = words.filter((w) => /^[A-Za-z][a-z]+$/.test(w) || /^[A-Z][a-z]+$/.test(w));
    const nameWords = coreWords.length >= 2 ? coreWords.slice(0, 4) : words.slice(0, 4);
    return nameWords
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  function extractCredentialSuffix(line) {
    const raw = String(line || '').trim();
    if (!raw || raw.indexOf(',') === -1) return '';

    const trailing = raw
      .split(',')
      .slice(1)
      .map((part) => String(part || '').trim())
      .filter(Boolean);

    if (!trailing.length || trailing.length > 8) return '';

    const cleaned = trailing
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((part) => /^[A-Za-z0-9.'\-\/()®™ ]{2,22}$/.test(part));

    if (!cleaned.length) return '';

    return cleaned.join(', ');
  }

  function findBestNameLine(lines) {
    for (const line of lines.slice(0, 12)) {
      const candidate = cleanNameCandidate(line);
      if (!candidate) continue;
      const credentialSuffix = extractCredentialSuffix(line);
      return credentialSuffix ? `${candidate}, ${credentialSuffix}` : candidate;
    }
    return '';
  }

  function extractContactInfo(sourceText) {
    const text = String(sourceText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
    const phone = (text.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/) || [])[0] || '';
    const nameLine = findBestNameLine(lines);
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

    // Find closing line (Sincerely, Best regards, etc.)
    let closeIdx = nonEmpty.findIndex((line) =>
      /^(sincerely|best regards|kind regards|warm regards|yours truly|respectfully|thank you|with appreciation)\b/i.test(line)
    );
    // Fallback: last short line that could be a closing
    if (closeIdx < 0) {
      for (let i = nonEmpty.length - 1; i >= Math.max(0, nonEmpty.length - 5); i--) {
        if (/^(sincerely|best|kind|warm|yours|respectfully|thank)/i.test(nonEmpty[i])) {
          closeIdx = i;
          break;
        }
      }
    }
    if (closeIdx >= 0) {
      closing = nonEmpty[closeIdx];
      signature = nonEmpty[closeIdx + 1] || '';
    }

    // Body: between greeting and closing
    let bodyLines = nonEmpty;
    if (greetIdx >= 0) bodyLines = bodyLines.slice(greetIdx + 1);
    if (closeIdx >= 0) {
      const adjustedClose = greetIdx >= 0 ? closeIdx - (greetIdx + 1) : closeIdx;
      bodyLines = bodyLines.slice(0, Math.max(0, adjustedClose));
    }

    const rawParagraphs = bodyLines
      .join('\n')
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, ' ').trim())
      .filter(Boolean);

    const paragraphs = rebalanceCoverParagraphs(rawParagraphs)
      .filter((paragraph) => !/^generated by rolerocket ai\.?$/i.test(String(paragraph || '').trim()))
      .filter((paragraph) => !/^\[date\]$/i.test(String(paragraph || '').trim()))
      .filter((paragraph) => !/^(dear |sincerely|best regards|kind regards|warm regards|yours truly|respectfully)/i.test(String(paragraph || '').trim()));

    return {
      greeting,
      paragraphs,
      closing,
      signature
    };
  }

  function splitParagraphIntoChunks(paragraph) {
    const text = String(paragraph || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];

    const sentences = text.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    if (sentences.length <= 3) return [text];

    const chunks = [];
    let current = [];

    sentences.forEach((sentence) => {
      current.push(sentence);
      const joined = current.join(' ');
      const reachedSentenceLimit = current.length >= 3;
      const reachedLengthLimit = joined.length >= 360;

      if (reachedSentenceLimit || reachedLengthLimit) {
        chunks.push(joined);
        current = [];
      }
    });

    if (current.length) chunks.push(current.join(' '));
    return chunks;
  }

  function rebalanceCoverParagraphs(paragraphs) {
    const normalized = (paragraphs || [])
      .map((p) => String(p || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (!normalized.length) return [];
    if (normalized.length === 1) return splitParagraphIntoChunks(normalized[0]);

    const expanded = normalized.flatMap((paragraph) => {
      if (paragraph.length < 420) return [paragraph];
      return splitParagraphIntoChunks(paragraph);
    });

    return expanded.length ? expanded : normalized;
  }

  function renderCoverTemplate(letter, contact, roleTitle, company) {
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const paragraphHtml = letter.paragraphs.map((p) => `<p style="margin:0 0 12px 0;line-height:1.6;color:#1f2937;font-size:12pt;">${escapeHtml(p)}</p>`).join('');

    return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;box-shadow:0 8px 28px rgba(15,23,42,0.08);zoom:100%;">
        <div style="max-width:760px;margin:0 auto;font-family:Calibri, Arial, sans-serif;color:#0f172a;">
                    <div style="text-align:center;margin-bottom:16px;">
                      <div style="font-size:18pt;font-weight:700;color:#0f172a;">Cover Letter</div>
                    </div>

          <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #8ec7da;padding-bottom:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:28px;font-weight:800;color:#0e6e98;line-height:1.05;">${escapeHtml(contact.name || 'Candidate')}</div>
              <div style="font-size:12pt;color:#475569;">${escapeHtml([contact.phone, contact.email].filter(Boolean).join('  |  '))}</div>
            </div>
            <div style="font-size:12pt;color:#64748b;text-align:right;">${escapeHtml(today)}</div>
          </div>

          <div style="font-size:12pt;color:#334155;margin-bottom:12px;">
            <strong>Role:</strong> ${escapeHtml(roleTitle || 'Target Role')}<br>
            <strong>Company:</strong> ${escapeHtml(company || 'Target Company')}
          </div>

          <div style="font-size:12pt;font-weight:700;color:#0f172a;margin-bottom:10px;">${escapeHtml(letter.greeting)}</div>

          ${paragraphHtml}

          <div style="margin-top:12px;font-size:12pt;line-height:1.6;color:#1f2937;">
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
      const status = await loadCoverCreditStatus();
      if (status && !status.unlimited && !status.canGenerate) {
        output.innerHTML = '<div style="color:#dc2626;">No cover letter credits remaining. Buy a bundle to continue.</div>';
        return;
      }

      const jobDescription = buildJobDescription(jobTitle, company, fullJobDescription);
      const token = getAuthToken();
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
        await loadCoverCreditStatus();
      } else {
        if (res.status === 402 && data.code === 'DOC_CREDIT_REQUIRED') {
          renderCoverCreditStatus(data.status || coverCreditStatus);
          lastCover = '';
          output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'No cover letter credits remaining. Buy a bundle to continue.'}</div>`;
          return;
        }
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
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Cover Letter', 105, y, { align: 'center' });

    y += 8;

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

    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(today, 190, y, { align: 'right' });

    y += 9;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(letter.greeting, marginLeft, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
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

  function createCoverLetterPdfBlob(text) {
    if (!window.jspdf) throw new Error('PDF library not loaded.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    formatCoverForPdf(text, doc);
    return doc.output('blob');
  }

  function createCoverLetterWordBlob(parsed, roleTitle, company) {
    const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html><body style="font-family:Calibri, Arial, sans-serif;font-size:12pt;line-height:1.55;color:#1f2937;margin:0;"><div style="max-width:780px;margin:0 auto;padding:20px 24px;"><div style="text-align:center;margin-bottom:16px;"><div style="font-size:18pt;font-weight:700;color:#0f172a;">Cover Letter</div></div><div style="border-bottom:3px solid #8ec7da;padding-bottom:10px;margin-bottom:12px;"><div style="font-size:22pt;font-weight:800;color:#0e6e98;">${escapeHtml(lastCoverMeta.name || 'Candidate')}</div><div style="font-size:12pt;color:#64748b;">${escapeHtml([lastCoverMeta.phone, lastCoverMeta.email].filter(Boolean).join('  |  '))}</div><div style="font-size:12pt;color:#64748b;margin-top:6px;">${escapeHtml(today)}</div></div><div style="font-size:12pt;color:#334155;margin-bottom:10px;"><strong>Role:</strong> ${escapeHtml(roleTitle || 'Target Role')}<br><strong>Company:</strong> ${escapeHtml(company || 'Target Company')}</div><p style="margin:0 0 10px 0;font-weight:700;">${escapeHtml(parsed.greeting)}</p>${parsed.paragraphs.map((p) => `<p style="margin:0 0 12px 0;">${escapeHtml(p)}</p>`).join('')}<p style="margin:12px 0 0 0;">${escapeHtml(parsed.closing)}<br><strong>${escapeHtml(parsed.signature || lastCoverMeta.name || '')}</strong></p></div></body></html>`;
    return new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
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
        const html = `<!DOCTYPE html><html><body style="font-family:Calibri, Arial, sans-serif;font-size:12pt;line-height:1.55;color:#1f2937;margin:0;"><div style="max-width:780px;margin:0 auto;padding:20px 24px;"><div style="text-align:center;margin-bottom:16px;"><div style="font-size:18pt;font-weight:700;color:#0f172a;">Cover Letter</div></div><div style="border-bottom:3px solid #8ec7da;padding-bottom:10px;margin-bottom:12px;"><div style="font-size:22pt;font-weight:800;color:#0e6e98;">${escapeHtml(lastCoverMeta.name || 'Candidate')}</div><div style="font-size:12pt;color:#64748b;">${escapeHtml([lastCoverMeta.phone, lastCoverMeta.email].filter(Boolean).join('  |  '))}</div><div style="font-size:12pt;color:#64748b;margin-top:6px;">${escapeHtml(today)}</div></div><div style="font-size:12pt;color:#334155;margin-bottom:10px;"><strong>Role:</strong> ${escapeHtml(roleTitle || 'Target Role')}<br><strong>Company:</strong> ${escapeHtml(company || 'Target Company')}</div><p style="margin:0 0 10px 0;font-weight:700;">${escapeHtml(parsed.greeting)}</p>${parsed.paragraphs.map((p) => `<p style="margin:0 0 12px 0;">${escapeHtml(p)}</p>`).join('')}<p style="margin:12px 0 0 0;">${escapeHtml(parsed.closing)}<br><strong>${escapeHtml(parsed.signature || lastCoverMeta.name || '')}</strong></p></div></body></html>`;
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

  sendEmailBtn?.addEventListener('click', async function () {
    if (!lastCover) {
      output.innerHTML = '<div style="color:#dc2626;">No cover letter to send. Please generate first.</div>';
      return;
    }

    const roleTitle = document.getElementById('coverJobTitle').value.trim();
    const company = document.getElementById('coverCompany').value.trim();
    const parsed = parseCoverLetter(lastCover);
      const htmlContent = `<!DOCTYPE html><html><body style="font-family:Calibri, Arial, sans-serif;font-size:12pt;line-height:1.55;color:#1f2937;margin:0;padding:20px;zoom:100%;">${renderCoverTemplate(parsed, lastCoverMeta, roleTitle, company)}</body></html>`;
    const pdfBlob = createCoverLetterPdfBlob(lastCover);
    const wordBlob = createCoverLetterWordBlob(parsed, roleTitle, company);

    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = 'Sending...';
    const result = await window.sendDocumentToAccountEmail({
      feature: 'Cover Letter',
      filename: 'tailored-cover-letter',
      htmlContent,
      textContent: lastCover,
      attachments: [
        { filename: 'tailored-cover-letter.pdf', blob: pdfBlob, contentType: 'application/pdf' },
        { filename: 'tailored-cover-letter.doc', blob: wordBlob, contentType: 'application/msword' }
      ]
    });
    sendEmailBtn.disabled = false;
    sendEmailBtn.textContent = 'Send to Email';

    output.innerHTML = renderCoverTemplate(parsed, lastCoverMeta, roleTitle, company);
    if (result.ok) {
      output.insertAdjacentHTML('afterbegin', '<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:#ecfdf5;color:#166534;border:1px solid #86efac;">Sent! Check your inbox — if you don\'t see it within a minute, check your spam or junk folder.</div>');
    } else {
      output.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:10px;padding:10px 12px;border-radius:8px;font-size:0.95rem;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">${escapeHtml(result.error || 'Could not send email.')}</div>`);
    }
  });

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

  buySingleBtn?.addEventListener('click', function () {
    startCreditCheckout('single');
  });
  buyFiveBtn?.addEventListener('click', function () {
    startCreditCheckout('five');
  });
  buyTenBtn?.addEventListener('click', function () {
    startCreditCheckout('ten');
  });

  loadCoverCreditStatus().catch((error) => {
    if (billingStatus) billingStatus.textContent = error.message || 'Could not load billing status.';
  });

  const checkoutParams = new URLSearchParams(window.location.search);
  const checkoutResult = checkoutParams.get('docCredits');
  if (checkoutResult === 'success') {
    output.innerHTML = '<div style="color:#166534;background:#ecfdf5;border:1px solid #86efac;border-radius:8px;padding:10px 12px;">Credits added successfully. You can generate now.</div>';
    loadCoverCreditStatus().catch(() => {});
  } else if (checkoutResult === 'cancel') {
    output.innerHTML = '<div style="color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;">Checkout canceled. You can continue with your free generation or purchase anytime.</div>';
  }
});
