document.addEventListener('DOMContentLoaded', function () {
  const roleInput = document.getElementById('calendarRoleInput');
  const hoursInput = document.getElementById('calendarHoursInput');
  const constraintsInput = document.getElementById('calendarConstraintsInput');
  const generateBtn = document.getElementById('generateCalendarTaskBtn');
  const resultWrap = document.getElementById('calendarTaskResult');
  const downloadsWrap = document.getElementById('calendarTaskDownloads');
  const pdfBtn = document.getElementById('downloadCalendarTaskPdfBtn');
  const wordBtn = document.getElementById('downloadCalendarTaskWordBtn');
  const textArea = document.getElementById('calendarTaskText');
  const output = document.getElementById('calendarTaskOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'calendar-task-plan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'calendar-task-plan';
  }

  function getFileBaseName() {
    return slugify(`${roleInput?.value || 'calendar'}-${hoursInput?.value || 'tasks'}`);
  }

  function parseWeeklyHours(hours) {
    const raw = String(hours || '').trim();
    const range = raw.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/i);
    if (range) {
      const low = Number(range[1]);
      const high = Number(range[2]);
      return Number.isFinite(low) && Number.isFinite(high) ? Math.round((low + high) / 2) : 8;
    }
    const single = raw.match(/\d{1,2}/);
    return single ? Number(single[0]) : 8;
  }

  function splitConstraintNotes(constraints) {
    return String(constraints || '')
      .split(/[\n.;]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Calendar & Task AI Plan', 20, y);
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

  function buildWeeklyPlan(goal, hours, constraints) {
    const targetRole = goal || 'your target leadership role';
    const normalizedHours = hours || '6-8 hours';
    const weeklyHours = Math.max(4, parseWeeklyHours(normalizedHours));
    const notes = splitConstraintNotes(constraints);
    const weeklyBlocks = Math.max(4, Math.round(weeklyHours / 2));

    const priorityNarrative = notes.length
      ? notes.join('; ')
      : 'Maintain momentum across strategic applications, executive networking, and interview readiness.';

    return [
      `Executive Weekly Plan: ${targetRole}`,
      '',
      '1) Strategic Objective',
      `- Primary outcome this week: move ${targetRole} opportunities from interest to interview-ready pipeline with measurable execution quality.`,
      `- Available capacity: ${normalizedHours} (~${weeklyBlocks} focused work blocks this week).`,
      `- Operating constraints: ${priorityNarrative}`,
      '',
      '2) Executive Focus Areas (Ranked)',
      '- Pipeline Quality: prioritize fewer, higher-fit roles with stronger tailoring depth.',
      '- Stakeholder Influence: increase response rate through targeted networking and follow-up sequencing.',
      '- Interview Readiness: convert role requirements into concise achievement stories and proof points.',
      '',
      '3) KPI Targets for Week-End Review',
      '- Applications sent (high-fit only): 2-4',
      '- Executive outreach touches (new + follow-up): 8-12',
      '- Interview story bank updates: 3-5 quantified examples',
      '- Resume/ATS iterations completed: 2+',
      '',
      '4) Weekly Operating Cadence (Detailed)',
      '- Monday | Strategy + Positioning',
      '  Outcome: finalize target-account list and submit the single highest-conviction application.',
      '  Time blocks: role triage (45m), resume tailoring (60m), application + recruiter note (45m).',
      '- Tuesday | Influence + Follow-Through',
      '  Outcome: run outreach sprint and clear all pending follow-up obligations.',
      '  Time blocks: contact prioritization (30m), outreach drafting (60m), follow-up sends (45m).',
      '- Wednesday | Interview Asset Build',
      '  Outcome: produce polished STAR stories mapped to role-critical competencies.',
      '  Time blocks: competency mapping (40m), story drafting (60m), response rehearsal (40m).',
      '- Thursday | Second Conversion Sprint',
      '  Outcome: complete another tailored application and send decision-maker follow-ups.',
      '  Time blocks: JD decomposition (30m), resume refinement (60m), application + outreach (45m).',
      '- Friday | Executive Retrospective + Next Plan',
      '  Outcome: review KPIs, remove low-yield activities, and publish next-week priorities.',
      '  Time blocks: KPI review (30m), pipeline hygiene (30m), next-week planning (45m).',
      '',
      '5) Risk Controls and Mitigations',
      '- Risk: high activity but weak conversion.',
      '  Mitigation: enforce high-fit threshold before each application is submitted.',
      '- Risk: outreach volume without response quality.',
      '  Mitigation: personalize each outreach with a role-specific business value statement.',
      '- Risk: interview prep drift.',
      '  Mitigation: lock one non-negotiable rehearsal block midweek.',
      '',
      '6) End-of-Week Decision Rules',
      '- Double down on channels producing interview movement.',
      '- Stop activities that do not improve interview probability.',
      '- Carry forward only the top 3 priorities into next week.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      textArea.value = buildWeeklyPlan(
        roleInput?.value.trim(),
        hoursInput?.value.trim(),
        constraintsInput?.value.trim()
      );
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Weekly plan generated and ready to download.', '#16a34a');
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the plan before downloading.', '#dc2626');
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
        setMessage('Generate the plan before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
