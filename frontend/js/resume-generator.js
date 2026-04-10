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
      // Send a single jobDescription field for backend compatibility
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}`;
      const resume = baseResume;
      // Always send Authorization header if token is present
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription, resume })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        output.innerHTML = `<pre style="background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;">${data.result}</pre>`;
      } else {
        output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'Failed to generate resume.'}</div>`;
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating resume.</div>';
    }
  });
});
