document.addEventListener('DOMContentLoaded', function () {
  const resumeInput = document.getElementById('portfolioResumeInput');
  const targetInput = document.getElementById('portfolioTargetInput');
  const projectsInput = document.getElementById('portfolioProjectsInput');
  const generateBtn = document.getElementById('generatePortfolioBtn');
  const resultWrap = document.getElementById('portfolioResult');
  const downloadsWrap = document.getElementById('portfolioDownloads');
  const pdfBtn = document.getElementById('downloadPortfolioPdfBtn');
  const wordBtn = document.getElementById('downloadPortfolioWordBtn');
  const textArea = document.getElementById('portfolioText');
  const output = document.getElementById('portfolioOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'portfolio-blueprint')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'portfolio-blueprint';
  }

  function getFileBaseName() {
    return slugify(`${targetInput?.value || 'portfolio'}-blueprint`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('AI Portfolio Builder', 20, y);
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

  function extractHighlights(rawValue) {
    return String(rawValue || '')
      .split(/[\n.]/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  function buildPortfolioBlueprint(resumeText, targetRole, projectsText) {
    const highlights = extractHighlights(resumeText);
    const projects = extractHighlights(projectsText);

    return [
      `Portfolio Blueprint for ${targetRole || 'your target audience'}`,
      '',
      'Recommended site sections:',
      '- Hero section with one-sentence positioning statement and a clear CTA.',
      '- Featured work section with 2-3 case studies focused on business impact.',
      '- Proof section with metrics, testimonials, awards, or outcomes.',
      '- About section that connects your background to the role you want next.',
      '',
      `Core positioning statement: ${targetRole || 'I solve meaningful business problems'} supported by ${highlights.join(', ') || 'your strongest achievements and domain experience'}.`,
      '',
      'Projects to feature first:',
      ...(projects.length ? projects.map((project, index) => `- Project ${index + 1}: ${project}`) : ['- Add 2 or 3 flagship projects with measurable outcomes.']),
      '',
      'Content guidance:',
      `- Use these strengths throughout the site: ${highlights.join(', ') || 'leadership, execution, and measurable impact'}.`,
      '- Keep each case study focused on problem, approach, and business result.',
      '- End every project with one sentence about what you would improve next.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      const resumeText = resumeInput?.value.trim();
      if (!resumeText) {
        setMessage('Add your resume highlights before generating the portfolio blueprint.', '#dc2626');
        return;
      }

      textArea.value = buildPortfolioBlueprint(
        resumeText,
        targetInput?.value.trim(),
        projectsInput?.value.trim()
      );
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Portfolio blueprint generated and ready to download.', '#16a34a');
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the blueprint before downloading.', '#dc2626');
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
        setMessage('Generate the blueprint before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});