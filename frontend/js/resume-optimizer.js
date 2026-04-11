// Resume Optimizer Save as PDF/Word logic

document.addEventListener('DOMContentLoaded', function () {
  const savePdfBtn = document.getElementById('saveResumePdfBtn');
  const saveWordBtn = document.getElementById('saveResumeWordBtn');
  const output = document.getElementById('resumeOutput');
  let lastResume = '';

  // After rewrite, update lastResume
  const rewriteBtn = document.getElementById('rewriteResumeBtn');
  if (rewriteBtn) {
    rewriteBtn.addEventListener('click', function () {
      setTimeout(() => {
        const pre = output.querySelector('pre');
        if (pre) {
          lastResume = pre.textContent;
        }
      }, 500);
    });
  }

  if (savePdfBtn) {
    savePdfBtn.onclick = function() {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const text = lastResume.replace(/\n/g, '\n');
      doc.setFont('helvetica');
      doc.setFontSize(12);
      doc.text(text, 10, 20, { maxWidth: 180 });
      doc.save('resume.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
        return;
      }
      const blob = new Blob([lastResume], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'resume.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }
});
