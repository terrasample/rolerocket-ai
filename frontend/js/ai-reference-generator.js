// AI Reference Generator Download Logic

document.addEventListener('DOMContentLoaded', async function () {
  const pdfBtn = document.getElementById('downloadReferenceGenPdfBtn');
  const wordBtn = document.getElementById('downloadReferenceGenWordBtn');
  const textArea = document.getElementById('referenceGenText');
  const output = document.getElementById('referenceGenOutput');

  // Personalized report fetch logic
  const token = localStorage.getItem('token');
  if (token && typeof apiUrl === 'function') {
    try {
      const res = await fetch(apiUrl('/api/ai-reference-generator'), {
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

  function formatReferenceGenForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 28;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('Reference Letter', 25, y);
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
        output.innerHTML = '<div style="color:#dc2626;">No reference letter to download.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatReferenceGenForPdf(text, doc);
      doc.save('reference-letter.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function() {
      const text = textArea.value.trim();
      if (!text) {
        output.innerHTML = '<div style="color:#dc2626;">No reference letter to download.</div>';
        return;
      }
      const content = 'Reference Letter\n\n' + text;
      const blob = new Blob([content], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'reference-letter.doc';
      a.click();
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }
});
