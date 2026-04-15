// Cover Letter Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveCoverPdfBtn');
  const saveWordBtn = document.getElementById('saveCoverWordBtn');
  const generateBtn = document.getElementById('generateCoverBtn');
  const output = document.getElementById('coverLetterOutput');
  let lastCover = '';

  generateBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('coverJobTitle').value.trim();
    const company = document.getElementById('coverCompany').value.trim();
    const resume = document.getElementById('coverResume').value.trim();
    const fullJobDescription = document.getElementById('coverJobDescription').value.trim();
    if (!jobTitle || !company || !resume || !fullJobDescription) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Generating cover letter...';
    try {
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}\n\nFull Job Description:\n${fullJobDescription}`;
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
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
        output.innerHTML = `<pre style=\"background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;\">${data.result}</pre>`;
      } else {
        lastCover = '';
        output.innerHTML = `<div style=\"color:#dc2626;font-size:1.1em;padding:12px 0;\">${data.error || 'Failed to generate cover letter.'}</div>`;
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating cover letter.</div>';
      lastCover = '';
    }
  });

  function formatCoverForPdf(text, doc) {
    // College-style: 1-inch margins, 12pt, double-spaced, left-aligned, readable font
    const lines = text.split(/\r?\n/);
    const marginLeft = 25; // ~1 inch
    const marginTop = 28; // ~1 inch
    const lineHeight = 12 * 2; // double-spaced, 12pt font
    let y = marginTop;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    // Title
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Cover Letter', marginLeft, y);
    y += lineHeight * 1.5;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    lines.forEach(line => {
      if (/^\s*$/.test(line)) {
        y += lineHeight; // blank line = double space
      } else if (/^Dear /.test(line) || /^To /.test(line)) {
        doc.setFont('times', 'bold');
        doc.text(line, marginLeft, y);
        doc.setFont('times', 'normal');
        y += lineHeight;
      } else if (/^Sincerely|Warm regards|Best regards|Yours truly|Yours sincerely/.test(line)) {
        y += lineHeight * 0.7;
        doc.setFont('times', 'bold');
        doc.text(line, marginLeft, y);
        doc.setFont('times', 'normal');
        y += lineHeight;
      } else {
        // Wrap long lines
        const splitLines = doc.splitTextToSize(line, 160);
        splitLines.forEach(wrapLine => {
          doc.text(wrapLine, marginLeft, y);
          y += lineHeight;
        });
      }
      if (y > 270) { doc.addPage(); y = marginTop; }
    });
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
      doc.save('cover-letter.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  function formatCoverForWord(text) {
    // College-style: 1-inch margins, 12pt, double-spaced, left-aligned, readable font
    let formatted = '';
    const lines = text.split(/\r?\n/);
    formatted += 'Cover Letter\n\n';
    lines.forEach(line => {
      if (/^\s*$/.test(line)) {
        formatted += '\n';
      } else if (/^Dear /.test(line) || /^To /.test(line)) {
        formatted += line + '\n';
      } else if (/^Sincerely|Warm regards|Best regards|Yours truly|Yours sincerely/.test(line)) {
        formatted += '\n' + line + '\n';
      } else {
        formatted += line + '\n\n';
      }
    });
    return formatted;
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastCover) {
        output.innerHTML = '<div style=\"color:#dc2626;\">No cover letter to save. Please generate first.</div>';
        return;
      }
      const content = formatCoverForWord(lastCover);
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${content.replace(/\n/g, '<br>')}</body></html>`;
      const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cover-letter.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }
});
