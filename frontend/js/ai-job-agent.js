document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('jobAgentRoleInput');
  const locationInput = document.getElementById('jobAgentLocationInput');
  const preferencesInput = document.getElementById('jobAgentPreferencesInput');
  const generateBtn = document.getElementById('generateJobAgentBtn');
  const resultWrap = document.getElementById('jobAgentResult');
  const downloadsWrap = document.getElementById('jobAgentDownloads');
  const matchesWrap = document.getElementById('jobAgentMatches');
  const pdfBtn = document.getElementById('downloadJobAgentPdfBtn');
  const wordBtn = document.getElementById('downloadJobAgentWordBtn');
  const textArea = document.getElementById('jobAgentText');
  const output = document.getElementById('jobAgentOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'job-agent-report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'job-agent-report';
  }

  function getFileBaseName() {
    return slugify(`${roleInput?.value || 'job-agent'}-${locationInput?.value || 'report'}`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('AI Job Agent Report', 20, y);
    y += 12;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 170) : [''];
      wrapped.forEach((part) => {
        if (y > 275) {
          doc.addPage();
          y = 24;
        }
        doc.text(part, 20, y);
        y += 8;
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

  if (generateBtn) {
    generateBtn.onclick = async function () {
      const params = new URLSearchParams({
        title: roleInput?.value || 'software engineer',
        location: locationInput?.value || 'remote',
        preferences: preferencesInput?.value || '',
        limit: '5'
      });

      generateBtn.disabled = true;
      generateBtn.textContent = 'Scouting Jobs...';
      setMessage('', '#16a34a');

      try {
        const response = await fetch(`/api/jobs/scout?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not scout jobs.');
        }

        textArea.value = data.report || '';
        matchesWrap.innerHTML = (data.jobs || []).map((job) => `
          <article style="padding:12px 14px;margin-bottom:10px;border:1px solid rgba(96,165,250,.35);border-radius:12px;background:rgba(15,23,42,.28);">
            <strong>${job.title}</strong><br />
            <span>${job.company} · ${job.location}</span><br />
            <a href="${job.link}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;">Open listing</a>
          </article>
        `).join('');
        resultWrap.style.display = 'block';
        downloadsWrap.style.display = 'block';
        setMessage('Job recommendations generated and ready to download.', '#16a34a');
      } catch (error) {
        setMessage(error.message || 'Could not scout jobs.', '#dc2626');
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Scout Jobs For Me';
      }
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate job recommendations before downloading.', '#dc2626');
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
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate job recommendations before downloading.', '#dc2626');
        return;
      }

      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
