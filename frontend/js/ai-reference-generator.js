// AI Reference Generator Download Logic

document.addEventListener('DOMContentLoaded', async function () {
  const pdfBtn = document.getElementById('downloadReferenceGenPdfBtn');
  const wordBtn = document.getElementById('downloadReferenceGenWordBtn');
  const textArea = document.getElementById('referenceGenText');
  const output = document.getElementById('referenceGenOutput');
  const startBtn = document.getElementById('startReferenceGenBtn');
  const container = document.getElementById('referenceGenContainer');

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

  // --- Reference Generation CTA logic ---
  if (startBtn && container) {
    startBtn.onclick = function() {
      startBtn.style.display = 'none';
      container.style.display = 'none';
      output.innerHTML = '';

      // Simple form for reference details
      output.innerHTML = `<div style='margin:18px 0;'>
        <strong>Reference Generator</strong><br>
        <label>Name to Recommend:<br><input id='refName' style='width:80%;margin:6px 0;'></label><br>
        <label>Position:<br><input id='refPosition' style='width:80%;margin:6px 0;'></label><br>
        <label>Your Name:<br><input id='refYourName' style='width:80%;margin:6px 0;'></label><br>
        <button id='generateRefBtn' class='feature-launch-btn' style='margin-top:10px;'>Generate Reference Letter</button>
      </div>`;
      document.getElementById('generateRefBtn').onclick = function() {
        const name = document.getElementById('refName').value || 'Jane Doe';
        const pos = document.getElementById('refPosition').value || 'Product Manager';
        const your = document.getElementById('refYourName').value || 'John Smith';
        const letter = `To Whom It May Concern,\n\nI am pleased to recommend ${name} for the position of ${pos}. ${name} consistently demonstrated leadership, initiative, and a strong work ethic during their time at our company.\n\nSincerely,\n${your}`;
        output.innerHTML = `<div style='margin:18px 0;'><strong>Generated Reference Letter:</strong><br><textarea style='width:100%;max-width:600px;height:180px;margin:12px 0;'>${letter}</textarea><br><button id='restartRefBtn' class='feature-launch-btn'>Start Again</button></div>`;
        document.getElementById('restartRefBtn').onclick = function() {
          output.innerHTML = '';
          startBtn.style.display = '';
          container.style.display = '';
        };
      };
    };
  }
});
