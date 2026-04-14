// PDF download logic for Resume Optimizer
document.addEventListener('DOMContentLoaded', function () {
  const downloadBtn = document.getElementById('downloadResumePdfBtn');
  const output = document.getElementById('resumeOutput');
  let lastResume = '';
  // Patch: Show download button after rewrite
  const rewriteBtn = document.getElementById('rewriteResumeBtn');
  if (rewriteBtn) {
    rewriteBtn.addEventListener('click', function () {
      setTimeout(() => {
        const pre = output.querySelector('pre');
        if (pre) {
          lastResume = pre.textContent;
          downloadBtn.style.display = '';
        }
      }, 500);
    });
  }
  if (downloadBtn) {
    downloadBtn.onclick = function() {
      if (!lastResume) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const text = lastResume.replace(/\n/g, '\n');
      doc.setFont('times');
      doc.setFontSize(12);
      doc.text(text, 10, 20, { maxWidth: 180 });
      doc.save('resume.pdf');
    };
  }
});
// Resume Generator Logic

document.addEventListener('DOMContentLoaded', function () {
  const rewriteBtn = document.getElementById('rewriteResumeBtn');
  const downloadBtn = document.getElementById('downloadResumePdfBtn');
  const saveBtn = document.getElementById('saveResumeBtn');
  const output = document.getElementById('resumeOutput');
  let lastResume = '';

  rewriteBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitle').value.trim();
    const company = document.getElementById('resumeCompany').value.trim();
    const baseResume = document.getElementById('resumeBase').value.trim();
    if (!jobTitle || !company || !baseResume) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Rewriting resume...';
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
        output.innerHTML = `<div style="color:#dc2626;font-size:1.1em;padding:12px 0;">${data.error || 'Failed to rewrite resume.'}</div>`;
        if (downloadBtn) downloadBtn.style.display = 'none';
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error rewriting resume.</div>';
    }
  });

  downloadBtn.onclick = function() {
    if (!lastResume) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const text = lastResume.replace(/\n/g, '\n');
    doc.setFont('times');
    doc.setFontSize(12);
    doc.text(text, 10, 20, { maxWidth: 180 });
    doc.save('resume.pdf');
  };

  saveBtn.onclick = function() {
    if (!lastResume) {
      output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
      return;
    }
    // Save logic here (e.g., send to backend)
    output.innerHTML = '<div style="color:#16a34a;">Resume saved (mock).</div>';
  };
});
