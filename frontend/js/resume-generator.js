// Resume Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtn');
  const output = document.getElementById('resumeOutput');

  generateBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitle').value.trim();
    const company = document.getElementById('resumeCompany').value.trim();
    const baseResume = document.getElementById('resumeBase').value.trim();
    if (!jobTitle || !company || !baseResume) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Generating resume...';
    try {
      const res = await fetch('/api/resume-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, company, baseResume })
      });
      const data = await res.json();
      if (res.ok && data.resume) {
        output.innerHTML = `<pre style="background:#f8fafc;padding:14px;border-radius:8px;">${data.resume}</pre>`;
      } else {
        output.innerHTML = `<div style="color:#dc2626;">${data.error || 'Failed to generate resume.'}</div>`;
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating resume.</div>';
    }
  });
});
