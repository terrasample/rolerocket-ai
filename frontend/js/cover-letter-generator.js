// Cover Letter Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const downloadBtn = document.getElementById('downloadCoverPdfBtn');
  const generateBtn = document.getElementById('generateCoverBtn');
  const output = document.getElementById('coverLetterOutput');

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
      // Send a single jobDescription field for backend compatibility
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}`;
      // Always send Authorization header if token is present
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
          output.innerHTML = `<pre style=\"background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;\">${data.result}</pre>`;
          if (downloadBtn) downloadBtn.style.display = '';
          downloadBtn.onclick = function() {
            import('jspdf').then(({ jsPDF }) => {
              const doc = new jsPDF();
              const text = data.result.replace(/\n/g, '\n');
              doc.setFont('helvetica');
              doc.setFontSize(12);
              doc.text(text, 10, 20, { maxWidth: 180 });
              doc.save('cover-letter.pdf');
            });
          };
        } else {
          output.innerHTML = `<div style=\"color:#dc2626;font-size:1.1em;padding:12px 0;\">${data.error || 'Failed to generate cover letter.'}</div>`;
          if (downloadBtn) downloadBtn.style.display = 'none';
        }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating cover letter.</div>';
    }
  });
});
