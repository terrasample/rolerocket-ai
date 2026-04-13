// Application Quality Score Download Logic

document.addEventListener('DOMContentLoaded', async function () {
  const pdfBtn = document.getElementById('downloadAppQualityPdfBtn');
  const wordBtn = document.getElementById('downloadAppQualityWordBtn');
  const textArea = document.getElementById('appQualityText');
  const output = document.getElementById('appQualityOutput');

  // Personalized report fetch logic
  const token = localStorage.getItem('token');
  if (token && typeof apiUrl === 'function') {
    try {
      const res = await fetch(apiUrl('/api/application-quality-score'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.report) {
          textArea.value = data.report;
        }
      }
    } catch (e) { /* fallback to sample */ }
  }

  function formatAppQualityForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 28;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('Application Quality Score Report', 25, y);
    y += 24;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const lineHeight = 24;
    lines.forEach(line => {
      if (/^\s*$/.test(line)) {
        y += lineHeight / 2;
      } else {
        const splitLines = doc.splitTextToSize(line, 160);
        splitLines.forEach(wrapLine => {
          doc.text(wrapLine, 25, y);
          y += lineHeight / 1.5;
        });
      }
      if (y > 270) { doc.addPage(); y = 28; }
    });
  }

  if (pdfBtn) {
    pdfBtn.onclick = function() {
      const text = textArea.value.trim();
      if (!text) {
        output.innerHTML = '<div style="color:#dc2626;">No report to download.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatAppQualityForPdf(text, doc);
      doc.save('application-quality-score.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function() {
      const text = textArea.value.trim();
      if (!text) {
        output.innerHTML = '<div style="color:#dc2626;">No report to download.</div>';
        return;
      }
      const content = 'Application Quality Score Report\n\n' + text;
      const blob = new Blob([content], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'application-quality-score.doc';
      a.click();
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }
});
