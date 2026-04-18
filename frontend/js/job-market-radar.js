document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('marketRadarRoleInput');
  const locationInput = document.getElementById('marketRadarLocationInput');
  const generateBtn = document.getElementById('generateMarketRadarBtn');
  const resultWrap = document.getElementById('marketRadarResult');
  const downloadsWrap = document.getElementById('marketRadarDownloads');
  const pdfBtn = document.getElementById('downloadMarketRadarPdfBtn');
  const wordBtn = document.getElementById('downloadMarketRadarWordBtn');
  const textArea = document.getElementById('marketRadarText');
  const preview = document.getElementById('marketRadarPreview');
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

  function roleKeywords(role) {
    return String(role || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2);
  }

  function isGenericRoleToken(token) {
    return ['manager', 'engineer', 'analyst', 'specialist', 'coordinator', 'associate', 'lead', 'senior', 'junior', 'staff'].includes(token);
  }

  function buildTargetRoleSuggestions(targetRole) {
    const normalized = String(targetRole || '').trim();
    const lower = normalized.toLowerCase();

    let suggestions;
    if (lower.includes('project manager')) {
      suggestions = [
        'Project Manager',
        'Technical Project Manager',
        'Program Manager',
        'Delivery Manager',
        'Implementation Manager',
        'PMO Manager'
      ];
    } else if (lower.includes('product manager')) {
      suggestions = [
        'Product Manager',
        'Senior Product Manager',
        'Technical Product Manager',
        'Growth Product Manager',
        'Platform Product Manager',
        'Product Lead'
      ];
    } else {
      suggestions = [
        normalized || 'Target Role',
        `Senior ${normalized || 'Target Role'}`,
        `${normalized || 'Target Role'} Lead`,
        `${normalized || 'Target Role'} Specialist`
      ];
    }

    return suggestions.filter((value, index, array) => array.indexOf(value) === index);
  }

  function scoreRoleMatch(candidateRole, targetRole) {
    const targetTokens = roleKeywords(targetRole);
    const candidate = String(candidateRole || '').toLowerCase().trim();
    if (!targetTokens.length) return 0;

    const normalizedTarget = String(targetRole || '').toLowerCase().trim();
    if (candidate === normalizedTarget || candidate.includes(normalizedTarget)) {
      return 100;
    }

    const nonGenericTokens = targetTokens.filter((token) => !isGenericRoleToken(token));
    const genericTokens = targetTokens.filter((token) => isGenericRoleToken(token));
    const nonGenericHits = nonGenericTokens.filter((token) => candidate.includes(token)).length;
    const genericHits = genericTokens.filter((token) => candidate.includes(token)).length;

    if (nonGenericTokens.length && nonGenericHits === 0) {
      return genericHits ? 12 : 0;
    }

    const nonGenericScore = Math.round((nonGenericHits / Math.max(1, nonGenericTokens.length)) * 85);
    const genericScore = Math.round((genericHits / Math.max(1, targetTokens.length)) * 15);
    return Math.min(100, nonGenericScore + genericScore);
  }

  function topRoleMatches(industries, targetRole) {
    const allRoles = Object.entries(industries || {}).flatMap(([industry, roles]) =>
      (roles || []).map((role) => ({ industry, role, match: scoreRoleMatch(role, targetRole) }))
    );

    const strongMatches = allRoles
      .filter((item) => item.match >= 40)
      .sort((a, b) => b.match - a.match)
      .slice(0, 6);

    if (strongMatches.length) return strongMatches;

    const suggestedMatches = buildTargetRoleSuggestions(targetRole).map((role, index) => ({
      industry: 'Target Track',
      role,
      match: Math.max(70, 96 - (index * 5))
    }));

    return suggestedMatches
      .concat(allRoles.filter((item) => item.match >= 25).sort((a, b) => b.match - a.match))
      .slice(0, 6);
  }

  function buildActionPlan(targetRole, location, skills) {
    const primarySkills = skills.slice(0, 3).join(', ') || 'role-specific keywords';
    return [
      `Tailor your resume headline to "${targetRole}" and location preference "${location}".`,
      `Add measurable bullets using these skill signals: ${primarySkills}.`,
      'Run 2-3 targeted applications daily and mirror wording from each job post.',
      'Use STAR-format examples for interview prep based on your strongest projects.'
    ];
  }

  function buildReport(data, role, location) {
    const industries = data.industries || {};
    const matches = topRoleMatches(industries, role);
    const flattenedRoles = Object.values(industries).flat().slice(0, 8);
    const trendingRoles = flattenedRoles.length ? flattenedRoles : [];
    const skillsList = extractSkillSignals(industries);
    const skills = skillsList.join(', ') || 'Market data loading';
    const refreshDate = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : 'today';
    const actionPlan = buildActionPlan(role, location, skillsList);
    const confidence = matches.length ? Math.max(45, Math.round(matches.reduce((sum, item) => sum + item.match, 0) / matches.length)) : 40;

    const reportText = [
      `Job Market Radar for ${role} in ${location}`,
      '',
      `Market confidence score: ${confidence}/100`,
      '',
      'Top role matches:',
      ...(matches.length
        ? matches.map((item, idx) => `${idx + 1}. ${item.role} (${item.industry}) - ${item.match}% match`)
        : ['1. No role matches available right now.']),
      '',
      `Top trending roles: ${trendingRoles.join(', ') || 'No live role data available'}`,
      `In-demand skills: ${skills}`,
      '',
      `Market insights: Live market feed refreshed on ${refreshDate}. Remote-friendly roles remain strong, and candidates who align their resume to role-specific skills are getting faster traction.`,
      '',
      'Recommended next actions:',
      ...actionPlan.map((step, idx) => `${idx + 1}. ${step}`)
    ].join('\n');

    return {
      reportText,
      confidence,
      refreshDate,
      matches,
      skillsList,
      actionPlan
    };
  }

  function renderPreview(model, role, location) {
    if (!preview) return;

    const matchesMarkup = model.matches.length
      ? model.matches.map((item) => `<li style="color:#1e293b;font-size:1.06rem;">${item.role} <span style="color:#475569;">(${item.industry}, ${item.match}% match)</span></li>`).join('')
      : '<li>No role matches available right now.</li>';

    const skillsMarkup = model.skillsList.length
      ? model.skillsList.map((skill) => `<li style="color:#1e293b;font-size:1.06rem;">${skill}</li>`).join('')
      : '<li>Skill data is still loading.</li>';

    const actionsMarkup = model.actionPlan.map((step) => `<li style="color:#1e293b;font-size:1.06rem;">${step}</li>`).join('');

    preview.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px;">
        <div style="padding:12px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;">
          <div style="font-size:0.8rem;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Target</div>
          <div style="margin-top:4px;color:#0f172a;font-weight:800;font-size:1.95rem;line-height:1.25;">${role}</div>
          <div style="color:#334155;font-size:1.18rem;">${location}</div>
        </div>
        <div style="padding:12px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;">
          <div style="font-size:0.8rem;color:#15803d;font-weight:700;text-transform:uppercase;">Confidence</div>
          <div style="margin-top:4px;color:#0f172a;font-weight:800;font-size:1.95rem;line-height:1.2;">${model.confidence}/100</div>
          <div style="color:#334155;font-size:1.16rem;">Last refresh: ${model.refreshDate}</div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <strong style="display:block;margin-bottom:6px;color:#0f172a;font-size:1.45rem;">Top Role Matches</strong>
        <ul style="margin:0 0 0 22px;padding:0;line-height:1.75;">${matchesMarkup}</ul>
      </div>
      <div style="margin-bottom:12px;">
        <strong style="display:block;margin-bottom:6px;color:#0f172a;font-size:1.45rem;">In-Demand Skills to Mirror</strong>
        <ul style="margin:0 0 0 22px;padding:0;line-height:1.75;">${skillsMarkup}</ul>
      </div>
      <div>
        <strong style="display:block;margin-bottom:6px;color:#0f172a;font-size:1.45rem;">Action Plan (Next 7 Days)</strong>
        <ol style="margin:0 0 0 22px;padding:0;line-height:1.75;">${actionsMarkup}</ol>
      </div>
    `;
    preview.style.display = 'block';
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
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
        const reportModel = buildReport(data, role, location);
        textArea.value = reportModel.reportText;
        renderPreview(reportModel, role, location);
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
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
