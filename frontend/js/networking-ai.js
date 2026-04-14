document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('networkingRoleInput');
  const goalInput = document.getElementById('networkingGoalInput');
  const backgroundInput = document.getElementById('networkingBackgroundInput');
  const generateBtn = document.getElementById('generateNetworkingAiBtn');
  const resultWrap = document.getElementById('networkingAiResult');
  const downloadsWrap = document.getElementById('networkingAiDownloads');
  const pdfBtn = document.getElementById('downloadNetworkingAiPdfBtn');
  const wordBtn = document.getElementById('downloadNetworkingAiWordBtn');
  const textArea = document.getElementById('networkingAiText');
  const output = document.getElementById('networkingAiOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'networking-plan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'networking-plan';
  }

  function getFileBaseName() {
    return slugify(`${roleInput?.value || 'networking'}-${goalInput?.value || 'plan'}`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Networking AI Plan', 20, y);
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

  function buildPlan(role, goal, background) {
    const snippets = background
      .split(/[\n.]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);

    return [
      `Networking Plan for ${role || 'your target field'}`,
      '',
      `Primary goal: ${goal || 'Create stronger professional momentum'}`,
      `Best proof points to mention: ${snippets.join('; ') || 'one relevant project, one quantified win, and one clear reason you are reaching out now'}.`,
      '',
      'Suggested connection targets:',
      `- 3 operators already working in ${role || 'your target space'}`,
      '- 2 recruiters or hiring managers connected to active openings',
      '- 2 peers who recently made the transition you want',
      '',
      'Outreach sequence:',
      '- Day 1: Send a short personalized introduction with one shared thread.',
      '- Day 4: Follow up with one concrete question they can answer quickly.',
      '- Day 10: Share a relevant project, case study, or update to keep the conversation warm.',
      '',
      'Message angle:',
      `- Lead with why ${role || 'this field'} matters to you now.`,
      '- Ask for perspective, not a job, in the first interaction.',
      '- Close with a low-friction next step such as a short call or one recommendation.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      textArea.value = buildPlan(
        roleInput?.value.trim(),
        goalInput?.value.trim(),
        backgroundInput?.value.trim()
      );
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Networking plan generated and ready to download.', '#16a34a');
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
