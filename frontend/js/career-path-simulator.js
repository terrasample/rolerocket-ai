document.addEventListener('DOMContentLoaded', function () {
  const currentRoleInput = document.getElementById('careerCurrentRole');
  const targetRoleInput = document.getElementById('careerTargetRole');
  const strengthsInput = document.getElementById('careerStrengths');
  const timelineInput = document.getElementById('careerTimeline');
  const generateBtn = document.getElementById('generateCareerPathBtn');
  const resultWrap = document.getElementById('careerPathResult');
  const downloadsWrap = document.getElementById('careerPathDownloads');
  const pdfBtn = document.getElementById('downloadCareerPathPdfBtn');
  const wordBtn = document.getElementById('downloadCareerPathWordBtn');
  const textArea = document.getElementById('careerPathText');
  const output = document.getElementById('careerPathOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'career-path-plan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'career-path-plan';
  }

  function getFileBaseName() {
    return slugify(`${currentRoleInput?.value || 'career'}-${targetRoleInput?.value || 'path'}`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Career Path Simulator', 20, y);
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

  function buildSimulation(currentRole, targetRole, strengths, timeline) {
    const strengthsList = strengths
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const primaryStrengths = strengthsList.slice(0, 4).join(', ') || 'communication, execution, and domain expertise';
    const steppingStone = targetRole && currentRole && targetRole.toLowerCase() !== currentRole.toLowerCase()
      ? `Bridge from ${currentRole} into a stretch assignment that looks like ${targetRole}.`
      : 'Use a stretch assignment to demonstrate leadership and broader scope.';

    return [
      `Career Path Simulation for ${currentRole || 'your current role'} -> ${targetRole || 'your next role'}`,
      '',
      `Target timeline: ${timeline || '12 months'}`,
      `Advantage signals to lean into: ${primaryStrengths}.`,
      '',
      'Recommended path:',
      `1. Strengthen your current-role proof with measurable wins tied to ${targetRole || 'the next role'}.`,
      `2. ${steppingStone}`,
      `3. Build visible proof in the next ${timeline || '12 months'} through projects, mentoring, and role-aligned portfolio examples.`,
      '',
      'Risk watchouts:',
      '- Avoid applying too early without role-specific evidence.',
      '- Translate your strongest work into business outcomes, not only responsibilities.',
      '',
      'Next 30-day actions:',
      `- Update your resume and LinkedIn to emphasize ${primaryStrengths}.`,
      `- Find 3 people already working in ${targetRole || 'your target path'} and study their progression.`,
      '- Start one proof project that closes your biggest experience gap.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      const report = buildSimulation(
        currentRoleInput?.value.trim(),
        targetRoleInput?.value.trim(),
        strengthsInput?.value.trim(),
        timelineInput?.value.trim()
      );

      textArea.value = report;
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Career path plan generated and ready to download.', '#16a34a');
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the plan before downloading.', '#dc2626');
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
        setMessage('Generate the plan before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
