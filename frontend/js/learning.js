document.addEventListener('DOMContentLoaded', function () {
  const targetRoleInput = document.getElementById('learningTargetRole');
  const currentLevelInput = document.getElementById('learningCurrentLevel');
  const timePerWeekInput = document.getElementById('learningTimePerWeek');
  const jobDescriptionInput = document.getElementById('learningJobDescription');
  const resumeInput = document.getElementById('learningResume');

  const generateBtn = document.getElementById('generateLearningPlanBtn');
  const clearBtn = document.getElementById('clearLearningFieldsBtn');
  const resultWrap = document.getElementById('learningResultWrap');
  const downloadsWrap = document.getElementById('learningDownloads');
  const planText = document.getElementById('learningPlanText');
  const output = document.getElementById('learningOutput');
  const pdfBtn = document.getElementById('downloadLearningPdfBtn');
  const wordBtn = document.getElementById('downloadLearningWordBtn');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function slugify(value) {
    return String(value || 'learning-roadmap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'learning-roadmap';
  }

  function getFileBaseName() {
    return slugify(`${targetRoleInput?.value || 'role'}-learning-roadmap`);
  }

  function clearFields() {
    if (targetRoleInput) targetRoleInput.value = '';
    if (currentLevelInput) currentLevelInput.value = '';
    if (timePerWeekInput) timePerWeekInput.value = '5';
    if (jobDescriptionInput) jobDescriptionInput.value = '';
    if (resumeInput) resumeInput.value = '';
    if (planText) planText.value = '';
    if (resultWrap) resultWrap.style.display = 'none';
    if (downloadsWrap) downloadsWrap.style.display = 'none';
    setMessage('Fields cleared.', '#16a34a');
  }

  function formatPdf(text, doc) {
    let y = 22;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('RoleRocketAI Learning Roadmap', 18, y);
    y += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);

    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 174) : [''];
      wrapped.forEach((part) => {
        if (y > 276) {
          doc.addPage();
          y = 22;
        }
        doc.text(part, 18, y);
        y += 7;
      });
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  generateBtn?.addEventListener('click', async function () {
    const targetRole = String(targetRoleInput?.value || '').trim();
    const currentLevel = String(currentLevelInput?.value || '').trim();
    const timePerWeek = String(timePerWeekInput?.value || '5').trim();
    const jobDescription = String(jobDescriptionInput?.value || '').trim();
    const resumeText = String(resumeInput?.value || '').trim();

    if (!targetRole || !jobDescription) {
      setMessage('Please add a target role and job description.', '#dc2626');
      return;
    }

    const token = getToken();
    if (!token) {
      setMessage('Please log in to use RoleRocketAI Learning.', '#dc2626');
      return;
    }

    setMessage('Generating your personalized learning roadmap...', '#2563eb');

    try {
      const res = await fetch('/api/learning/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetRole,
          currentLevel,
          timePerWeek,
          jobDescription,
          resumeText
        })
      });

      const data = await res.json();
      if (!res.ok || !data.result) {
        setMessage((data && data.error) || 'Failed to generate learning roadmap.', '#dc2626');
        return;
      }

      planText.value = String(data.result || '').trim();
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Learning roadmap generated.', '#16a34a');
    } catch (err) {
      setMessage('Error generating learning roadmap.', '#dc2626');
    }
  });

  clearBtn?.addEventListener('click', clearFields);

  pdfBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
      return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setMessage('PDF library not loaded.', '#dc2626');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    formatPdf(text, doc);
    doc.save(`${getFileBaseName()}.pdf`);
    setMessage('PDF downloaded.', '#16a34a');
  });

  wordBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
      return;
    }
    const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 10pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
    downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
    setMessage('Word document downloaded.', '#16a34a');
  });
});