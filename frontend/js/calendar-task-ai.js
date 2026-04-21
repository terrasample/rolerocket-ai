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

    const operatingGuardrails = notes.length
      ? notes.join('; ')
      : 'Keep momentum across applications, networking, and interview preparation.';

    return [
      'Weekly Operating Plan',
      '',
      'Primary Outcome (This Week)',
      `- ${weeklyOutcome}`,
      `- Capacity: ${normalizedHours} (~${weeklyBlocks} focused blocks).`,
      `- Operating guardrails: ${operatingGuardrails}`,
      '',
      'Priority Focus Areas',
      '- Pipeline quality: fewer applications, higher fit, better tailoring.',
      '- Decision-maker reach: consistent outreach and timely follow-up.',
      '- Interview readiness: sharpen measurable leadership stories for priority roles.',
      '',
      'Weekly Metrics to Track',
      '- High-fit applications submitted: 2-4',
      '- Outreach touches (new + follow-up): 8-12',
      '- Interview story updates (quantified): 3-5',
      '- Resume/ATS refinements completed: 2+',
      '',
      'Weekly Cadence',
      '- Monday: Prioritize top opportunities, tailor one resume, and submit the highest-fit role.',
      '- Tuesday: Execute outreach block and clear all outstanding follow-ups.',
      '- Wednesday: Build interview assets (STAR examples, business impact bullets, leadership narratives).',
      '- Thursday: Run second application sprint and reconnect with hiring stakeholders.',
      '- Friday: Review results, clean tracker, and lock next week’s top three priorities.',
      '',
      'Execution Standards',
      '- Every application must be role-specific and evidence-led.',
      '- Every outreach message should tie your value to a business outcome.',
      '- Protect one non-negotiable prep block midweek for interview readiness.',
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
