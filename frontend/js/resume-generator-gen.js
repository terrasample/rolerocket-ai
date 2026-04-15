// Resume Generator Logic (Distinct from Optimizer)

document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateResumeBtnGen');
  const savePdfBtn = document.getElementById('saveResumePdfBtnGen');
  const saveWordBtn = document.getElementById('saveResumeWordBtnGen');
  const output = document.getElementById('resumeOutputGen');
  let lastResume = '';

  generateBtn.addEventListener('click', async function () {
    const jobTitle = document.getElementById('resumeJobTitleGen').value.trim();
    const company = document.getElementById('resumeCompanyGen').value.trim();
    const baseResume = document.getElementById('resumeBaseGen').value.trim();
    const fullJobDescription = document.getElementById('resumeJobDescriptionGen').value.trim();
    if (!jobTitle || !company || !baseResume || !fullJobDescription) {
      output.innerHTML = '<div style="color:#dc2626;">Please fill in all fields.</div>';
      return;
    }
    output.innerHTML = 'Generating resume...';
    try {
      const jobDescription = `Job Title: ${jobTitle}\nCompany: ${company}\n\nFull Job Description:\n${fullJobDescription}`;
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
        output.innerHTML = `<pre style=\"background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;\">${data.result}</pre>`;
        // No PDF download button to show
      } else {
        output.innerHTML = `<div style=\"color:#dc2626;font-size:1.1em;padding:12px 0;\">${data.error || 'Failed to generate resume.'}</div>`;
        // No PDF download button to hide
      }
    } catch (err) {
      output.innerHTML = '<div style="color:#dc2626;">Error generating resume.</div>';
    }
  });


  // Save Resume button: prompt for format and save

  function formatResumeForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 20;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Generated Resume', 10, y);
    y += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    lines.forEach(line => {
      if (/^### /.test(line)) {
        y += 8;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^### /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^## /.test(line)) {
        y += 8;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^## /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 5;
      } else if (/^# /.test(line)) {
        y += 10;
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(line.replace(/^# /, ''), 10, y);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^\d+\. /.test(line)) {
        doc.text(line, 14, y);
        y += 6;
      } else if (/^- /.test(line)) {
        doc.text(line.replace(/^- /, '\u2022 '), 18, y);
        y += 6;
      } else if (/^\*\*.*\*\*$/.test(line)) {
        doc.setFont('times', 'bold');
        doc.text(line.replace(/\*\*/g, ''), 10, y);
        doc.setFont('times', 'normal');
        y += 6;
      } else if (line.trim() === '') {
        y += 4;
      } else {
        doc.text(line, 10, y);
        y += 6;
      }
      if (y > 270) { doc.addPage(); y = 20; }
    });
  }

  savePdfBtn.onclick = function() {
    if (!lastResume) {
      output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please generate first.</div>';
      return;
    }
    if (!window.jspdf) {
      output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    formatResumeForPdf(lastResume, doc);
    doc.save('resume.pdf');
    output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
  };

  function formatResumeForWord(text) {
    return (
      'Generated Resume\n\n' +
      text
        .replace(/^### (.*)$/gm, '\n\n$1\n' + '-'.repeat(40))
        .replace(/^## (.*)$/gm, '\n\n$1\n' + '-'.repeat(30))
        .replace(/^# (.*)$/gm, '\n\n$1\n' + '-'.repeat(20))
        .replace(/\*\*(.*?)\*\*/g, '$1'.toUpperCase())
        .replace(/^- /gm, '  • ')
        .replace(/\n{2,}/g, '\n\n')
    );
  }

  saveWordBtn.onclick = function() {
    if (!lastResume) {
      output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please generate first.</div>';
      return;
    }
    const content = formatResumeForWord(lastResume);
    const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;white-space:pre-wrap;">${content.replace(/\n/g, '<br>')}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'resume.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
  };
});
