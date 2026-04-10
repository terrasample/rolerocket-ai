// Cover Letter Generator Logic

document.addEventListener('DOMContentLoaded', function () {
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
      const res = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, resume })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        output.innerHTML = `<pre style="background:#f8fafc;padding:14px;border-radius:8px;">${data.result}</pre>`;
      } else {
        output.innerHTML = `<div style="color:#dc2626;">${data.error || 'Failed to generate cover letter.'}</div>`;
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating cover letter.</div>';
    }
  });
});
