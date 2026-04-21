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

  function formatWeeklyOutcome(goal) {
    const clean = String(goal || '').trim();
    if (!clean) return 'Advance priority opportunities into interview conversations this week.';
    if (/[.!?]$/.test(clean)) return clean;
    return `${clean}.`;
  }

  function inferRoleFocus(goal) {
    const clean = String(goal || '').trim();
    const normalized = clean.toLowerCase();

    if (!clean) {
      return {
        roleLabel: 'priority roles',
        proofLabel: 'leadership proof points',
        stakeholderLabel: 'hiring stakeholders'
      };
    }

    if (normalized.includes('project manager')) {
      return {
        roleLabel: 'project manager roles',
        proofLabel: 'delivery, stakeholder, and execution proof points',
        stakeholderLabel: 'project leaders, hiring managers, and operational decision-makers'
      };
    }

    if (normalized.includes('product manager')) {
      return {
        roleLabel: 'product manager roles',
        proofLabel: 'roadmap, launch, and cross-functional leadership proof points',
        stakeholderLabel: 'product leaders, hiring managers, and cross-functional partners'
      };
    }

    return {
      roleLabel: clean,
      proofLabel: 'business-impact proof points',
      stakeholderLabel: 'relevant hiring stakeholders'
    };
  }

  function buildPriorityBullets(notes) {
    if (!notes.length) {
      return [
        '- Keep applications selective and role-specific.',
        '- Maintain consistent outreach and follow-up cadence.',
        '- Protect dedicated time for interview preparation.'
      ];
    }
    return notes.slice(0, 3).map((note) => `- ${note}`);
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
    const weeklyOutcome = formatWeeklyOutcome(goal);
    const normalizedHours = hours || '6-8 hours';
    const weeklyHours = Math.max(4, parseWeeklyHours(normalizedHours));
    const notes = splitConstraintNotes(constraints);
    const weeklyBlocks = Math.max(4, Math.round(weeklyHours / 2));
    const roleFocus = inferRoleFocus(goal);
    const applicationTarget = weeklyHours >= 10 ? '3-5' : '2-4';
    const outreachTarget = weeklyHours >= 10 ? '10-14' : '6-10';
    const storyTarget = weeklyHours >= 10 ? '4-6' : '3-4';

    const operatingGuardrails = notes.length
      ? notes.join('; ')
      : 'Keep momentum across applications, networking, and interview preparation.';

    return [
      'Weekly Operating Plan',
      '',
      'This Week’s Objective',
      `- ${weeklyOutcome}`,
      `- Capacity: ${normalizedHours} (~${weeklyBlocks} focused blocks).`,
      `- Operating guardrails: ${operatingGuardrails}`,
      `- Focus roles: ${roleFocus.roleLabel}.`,
      '',
      'Priority Areas',
      ...buildPriorityBullets(notes),
      `- Strengthen ${roleFocus.proofLabel} before the next interview conversation.`,
      '',
      'Weekly Scorecard',
      `- High-fit applications submitted: ${applicationTarget}`,
      `- Outreach touches (new + follow-up): ${outreachTarget}`,
      `- Interview stories updated with quantified impact: ${storyTarget}`,
      '- Resume/ATS refinements completed: 2+',
      '',
      'Weekly Cadence',
      '- Monday: Review the market, narrow to the top opportunities, and submit the strongest role of the week.',
      '  Deliverable: one fully tailored application package and a clear shortlist for the remaining week.',
      '- Tuesday: Run your outreach block and clear follow-up obligations already in motion.',
      `  Deliverable: direct contact with ${roleFocus.stakeholderLabel} and a clean follow-up queue.`,
      '- Wednesday: Build interview assets and tighten your executive narrative.',
      `  Deliverable: refreshed ${roleFocus.proofLabel} plus three interview-ready stories.`,
      '- Thursday: Run the second conversion sprint on the next-best role.',
      '  Deliverable: second tailored submission plus any targeted follow-up tied to that opportunity.',
      '- Friday: Review results, clean the pipeline, and set the next week’s top three priorities.',
      '  Deliverable: updated tracker, clear decisions, and no loose ends carrying into Monday.',
      '',
      'Daily Non-Negotiables',
      '- Start each work block with a defined outcome before opening email or job boards.',
      '- Keep every application evidence-led and role-specific.',
      '- Tie every outreach message to a business outcome, not a generic introduction.',
      '',
      'Interview Preparation Focus',
      '- Prepare one story for leadership, one for execution, one for cross-functional alignment, and one for measurable impact.',
      '- Convert resume bullets into concise executive-level talking points.',
      '- Rehearse answers out loud at least once before the end of the week.',
      '',
      'Execution Standards',
      '- No low-fit applications submitted just to maintain volume.',
      '- No outreach sent without a clear reason for contact.',
      '- One protected preparation block must remain on the calendar midweek.',
      '',
      'Friday Review',
      '- Which actions created actual movement this week?',
      '- Which roles now deserve more time and which should be dropped?',
      '- What needs to be tightened before next week begins?',
      '',
      'End-of-Week Decisions',
      '- Double down on channels producing interview movement.',
      '- Stop low-yield activity immediately.',
      '- Carry only the top three priorities into next week.'
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
