document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('marketRadarRoleInput');
  const locationInput = document.getElementById('marketRadarLocationInput');
  const generateBtn = document.getElementById('generateMarketRadarBtn');
  const resultWrap = document.getElementById('marketRadarResult');
  const downloadsWrap = document.getElementById('marketRadarDownloads');
  const pdfBtn = document.getElementById('downloadMarketRadarPdfBtn');
  const wordBtn = document.getElementById('downloadMarketRadarWordBtn');
  const textArea = document.getElementById('marketRadarText');
  const output = document.getElementById('marketRadarOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'job-market-radar')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'job-market-radar';
  }

  function getFileBaseName() {
    return slugify(`${roleInput?.value || 'market'}-${locationInput?.value || 'radar'}`);
  }

  function extractSkillSignals(industries) {
    const skillMap = {
      technology: ['Python', 'Cloud', 'AI/ML', 'Platform Engineering'],
      healthcare: ['Patient Care', 'Care Coordination', 'Clinical Documentation', 'Compliance'],
      finance: ['Financial Modeling', 'Risk Analysis', 'Forecasting', 'Regulatory Reporting'],
      education: ['Curriculum Design', 'Instructional Design', 'Learning Analytics', 'Student Support'],
      manufacturing: ['Lean Operations', 'Quality Systems', 'Automation', 'Supply Chain'],
      retail: ['Merchandising', 'Inventory Planning', 'Customer Experience', 'Store Operations']
    };

    return Object.keys(industries)
      .flatMap((industry) => skillMap[industry.toLowerCase()] || [])
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 6);
  }

  function buildReport(data, role, location) {
    const industries = data.industries || {};
    const flattenedRoles = Object.values(industries).flat().slice(0, 6);
    const trendingRoles = flattenedRoles.length ? flattenedRoles.join(', ') : 'No live role data available';
    const skills = extractSkillSignals(industries).join(', ') || 'Market data loading';
    const refreshDate = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'today';

    return [
      `Job Market Radar for ${role} in ${location}`,
      '',
      `Top trending roles: ${trendingRoles}`,
      `In-demand skills: ${skills}`,
      `Market insights: Live market feed refreshed on ${refreshDate}. Remote-friendly roles remain strong, and candidates who align their resume to role-specific skills are getting faster traction.`
    ].join('\n');
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('Job Market Radar Report', 20, y);
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
      const role = roleInput?.value || 'Product Manager';
      const location = locationInput?.value || 'Remote';

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating Radar...';
      setMessage('', '#16a34a');

      try {
        const response = await fetch('/api/in-demand-jobs', { cache: 'no-store' });
        const data = await response.json();
        textArea.value = buildReport(data, role, location);
        resultWrap.style.display = 'block';
        downloadsWrap.style.display = 'block';
        setMessage('Job Market Radar generated and ready to download.', '#16a34a');
      } catch (error) {
        setMessage('Could not generate Job Market Radar right now.', '#dc2626');
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Market Radar';
      }
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the report before downloading.', '#dc2626');
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
        setMessage('Generate the report before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body>${text.split('\n').map((line) => `<p>${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
