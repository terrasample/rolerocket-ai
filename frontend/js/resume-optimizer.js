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

  function formatResumeForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Optimized Resume', 10, y);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    lines.forEach(line => {
      if (/^### /.test(line)) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(line.replace(/^### /, ''), 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^## /.test(line)) {
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(line.replace(/^## /, ''), 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        y += 5;
      } else if (/^# /.test(line)) {
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(line.replace(/^# /, ''), 10, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        y += 6;
      } else if (/^\d+\. /.test(line)) {
        doc.text(line, 14, y);
        y += 6;
      } else if (/^- /.test(line)) {
        doc.text(line.replace(/^- /, '\u2022 '), 18, y);
        y += 6;
      } else if (/^\*\*.*\*\*$/.test(line)) {
        doc.setFont('helvetica', 'bold');
        doc.text(line.replace(/\*\*/g, ''), 10, y);
        doc.setFont('helvetica', 'normal');
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
      formatResumeForPdf(lastResume, doc);
      doc.save('resume.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  function formatResumeForWord(text) {
    return (
      'Optimized Resume\n\n' +
      text
        .replace(/^### (.*)$/gm, '\n\n$1\n' + '-'.repeat(40))
        .replace(/^## (.*)$/gm, '\n\n$1\n' + '-'.repeat(30))
        .replace(/^# (.*)$/gm, '\n\n$1\n' + '-'.repeat(20))
        .replace(/\*\*(.*?)\*\*/g, '$1'.toUpperCase())
        .replace(/^- /gm, '  • ')
        .replace(/\n{2,}/g, '\n\n')
    );
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastResume) {
        output.innerHTML = '<div style="color:#dc2626;">No resume to save. Please rewrite first.</div>';
        return;
      }
      const content = formatResumeForWord(lastResume);
      const blob = new Blob([content], { type: 'application/msword' });
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
