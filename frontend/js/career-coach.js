document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('careerCoachBtn');
  const savePdfBtn = document.getElementById('saveCareerCoachPdfBtn');
  const saveWordBtn = document.getElementById('saveCareerCoachWordBtn');
  const roleInput = document.getElementById('careerRole');
  const goalsInput = document.getElementById('careerGoals');
  const resultDiv = document.getElementById('careerCoachResult');
  let lastPlan = '';

  btn.addEventListener('click', async function () {
    const role = roleInput.value.trim();
    const goals = goalsInput.value.trim();
    if (!role) {
      resultDiv.innerHTML = '<span style="color:#dc2626;">Please enter a target role or path.</span>';
      return;
    }
    resultDiv.innerHTML = 'Generating career coaching advice...';
    try {
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/career-coach', {
        method: 'POST',
        headers,
        body: JSON.stringify({ role, goals })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        lastPlan = data.result;
        resultDiv.innerHTML = `<pre style=\"background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;\">${data.result}</pre>`;
      } else {
        lastPlan = '';
        resultDiv.innerHTML = `<span style=\"color:#dc2626;\">${data.error || 'Failed to generate advice.'}</span>`;
      }
    } catch (err) {
      lastPlan = '';
      resultDiv.innerHTML = '<span style="color:#dc2626;">Error generating advice.</span>';
    }
  });

  function formatPlanForPdf(text, doc) {
    // Split by lines and parse markdown-like headers/lists
    const lines = text.split(/\r?\n/);
    let y = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Career Coach Focus Plan', 10, y);
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
      if (!lastPlan) {
        resultDiv.innerHTML += '<div style="color:#dc2626;">No plan to save. Please generate first.</div>';
        return;
      }
      if (!window.jspdf) {
        resultDiv.innerHTML += '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatPlanForPdf(lastPlan, doc);
      doc.save('career-coach-focus-plan.pdf');
      resultDiv.innerHTML += '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  function formatPlanForWord(text) {
    // Convert markdown-like to simple Word formatting
    return (
      'Career Coach Focus Plan\n\n' +
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
      if (!lastPlan) {
        resultDiv.innerHTML += '<div style="color:#dc2626;">No plan to save. Please generate first.</div>';
        return;
      }
      const content = formatPlanForWord(lastPlan);
      const blob = new Blob([content], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'career-coach-focus-plan.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resultDiv.innerHTML += '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }
});
