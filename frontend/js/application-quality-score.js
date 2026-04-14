document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('applicationRoleInput');
  const resumeInput = document.getElementById('applicationResumeInput');
  const jobInput = document.getElementById('applicationJobInput');
  const generateBtn = document.getElementById('generateAppQualityBtn');
  const resultWrap = document.getElementById('appQualityResult');
  const downloadsWrap = document.getElementById('appQualityDownloads');
  const pdfBtn = document.getElementById('downloadAppQualityPdfBtn');
  const wordBtn = document.getElementById('downloadAppQualityWordBtn');
  const textArea = document.getElementById('appQualityText');
  const output = document.getElementById('appQualityOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'application-quality-score')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'application-quality-score';
  }

  function getFileBaseName() {
    return slugify(`${roleInput?.value || 'application'}-quality-score`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('Application Quality Score', 20, y);
    y += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 170) : [''];
      wrapped.forEach((part) => {
        if (y > 275) {
          doc.addPage();
          y = 24;
        }
        doc.text(part, 20, y);
        y += 8;
      });
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function collectKeywords(text) {
    return Array.from(new Set(String(text || '').toLowerCase().match(/[a-z]{4,}/g) || []));
  }

  function buildReport(role, resumeText, jobText) {
    const resumeLower = resumeText.toLowerCase();
    const jobKeywords = collectKeywords(jobText).slice(0, 12);
    const matchedKeywords = jobKeywords.filter((keyword) => resumeLower.includes(keyword));
    const coverageScore = jobKeywords.length ? Math.round((matchedKeywords.length / jobKeywords.length) * 55) : 25;
    const quantifiedScore = /\d/.test(resumeText) ? 20 : 8;
    const structureScore = resumeText.length > 300 ? 15 : 8;
    const finalScore = Math.min(97, coverageScore + quantifiedScore + structureScore + 10);
    const missingKeywords = jobKeywords.filter((keyword) => !matchedKeywords.includes(keyword)).slice(0, 5);

    return [
      `Application Quality Score for ${role || 'your target role'}`,
      '',
      `Overall score: ${finalScore}/100`,
      `Keyword match coverage: ${matchedKeywords.length}/${jobKeywords.length || 1}`,
      '',
      'Strengths:',
      `- Matching language already present: ${matchedKeywords.slice(0, 5).join(', ') || 'Add more role-specific language from the job description.'}`,
      `- Evidence level: ${/\d/.test(resumeText) ? 'Quantified achievements detected.' : 'Add metrics to strengthen credibility.'}`,
      `- Readiness: ${resumeText.length > 300 ? 'You have enough detail to tailor effectively.' : 'Add more detail about impact and scope.'}`,
      '',
      'Highest-impact improvements:',
      `- Add or strengthen these keywords: ${missingKeywords.join(', ') || 'No major keyword gaps found in the sampled terms.'}`,
      '- Move the most relevant achievements into the top third of the application.',
      '- Rewrite bullets to show action, scope, and measurable result.',
      '',
      'Submission advice:',
      '- Tailor your summary line to the role title and business problem.',
      '- Mirror the employer language without copying full sentences.',
      '- Use one recent proof point that directly matches the role mandate.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      const resumeText = resumeInput?.value.trim();
      const jobText = jobInput?.value.trim();
      if (!resumeText || !jobText) {
        setMessage('Add your application draft and job description before scoring.', '#dc2626');
        return;
      }

      textArea.value = buildReport(roleInput?.value.trim(), resumeText, jobText);
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Application score generated and ready to download.', '#16a34a');
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the score before downloading.', '#dc2626');
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        setMessage('PDF library not loaded.', '#dc2626');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatPdf(text, doc);
      doc.save(`${getFileBaseName()}.pdf`);
      setMessage('PDF downloaded.', '#16a34a');
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the score before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body>${text.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
