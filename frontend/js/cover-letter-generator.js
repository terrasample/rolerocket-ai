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
    if (!jobTitle || !company || !resume) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Generating cover letter...';
    try {
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}`;
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
      const text = lastCover.replace(/\n/g, '\n');
      doc.setFont('helvetica');
      doc.setFontSize(12);
      doc.text(text, 10, 20, { maxWidth: 180 });
      doc.save('cover-letter.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastCover) {
        output.innerHTML = '<div style=\"color:#dc2626;\">No cover letter to save. Please generate first.</div>';
        return;
      }
      const blob = new Blob([lastCover], { type: 'application/msword' });
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
