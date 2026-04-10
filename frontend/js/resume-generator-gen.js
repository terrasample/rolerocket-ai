// Resume Generator Logic (Distinct from Optimizer)

document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const downloadBtn = document.getElementById('downloadResumePdfBtnGen');
  const saveBtn = document.getElementById('saveResumeBtnGen');
  const output = document.getElementById('resumeOutputGen');
  let lastResume = '';

  generateBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const baseResume = document.getElementById('resumeBaseGen').value.trim();
    if (!jobTitle || !company || !baseResume) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Generating resume...';
    try {
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}`;
      const resume = baseResume;
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
        lastResume = data.result;
        output.innerHTML = `<pre style="background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;">${data.result}</pre>`;
        if (downloadBtn) downloadBtn.style.display = '';
      } else {
        output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'Failed to generate resume.'}</div>`;
        if (downloadBtn) downloadBtn.style.display = 'none';
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating resume.</div>';
    }
  });

  downloadBtn.onclick = function() {
    if (!lastResume) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const text = lastResume.replace(/\n/g, '\n');
    doc.setFont('helvetica');
    doc.setFontSize(12);
    doc.text(text, 10, 20, { maxWidth: 180 });
    doc.save('resume.pdf');
  };

  saveBtn.onclick = function() {
    if (!lastResume) {
      output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please generate first.</div>';
      return;
    }
    // Save logic here (e.g., send to backend)
    output.innerHTML = '<div style="color:#16a34a;">Resume saved (mock).</div>';
  };
});
