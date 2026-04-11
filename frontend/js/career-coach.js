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
      doc.setFont('helvetica','bold');
      doc.setFontSize(16);
      doc.text('Career Coach Focus Plan', 10, 18);
      doc.setFont('helvetica','normal');
      doc.setFontSize(12);
      const text = lastPlan.replace(/\n{2,}/g, '\n');
      doc.text(text, 10, 30, { maxWidth: 180 });
      doc.save('career-coach-focus-plan.pdf');
      resultDiv.innerHTML += '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (saveWordBtn) {
    saveWordBtn.onclick = function() {
      if (!lastPlan) {
        resultDiv.innerHTML += '<div style="color:#dc2626;">No plan to save. Please generate first.</div>';
        return;
      }
      const content = 'Career Coach Focus Plan\n\n' + lastPlan;
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
