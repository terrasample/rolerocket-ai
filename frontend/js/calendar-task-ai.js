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
    const normalizedHours = hours || '6-8 hours';
    const notes = constraints
      .split(/[\n.]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);

    return [
      `Calendar & Task Plan for ${goal || 'your job search week'}`,
      '',
      `Available time: ${normalizedHours}`,
      `Priority constraints: ${notes.join('; ') || 'Keep momentum across applications, networking, and prep.'}`,
      '',
      'Suggested weekly rhythm:',
      '- Monday: shortlist top roles, tailor one resume, and submit your highest-fit application.',
      '- Tuesday: networking outreach block and follow-ups on pending applications.',
      '- Wednesday: interview prep or portfolio proof-building for priority roles.',
      '- Thursday: second application sprint plus recruiter follow-up messages.',
      '- Friday: review outcomes, clean your tracker, and plan the next week.',
      '',
      'Task focus:',
      `- Protect at least one uninterrupted block for ${goal || 'high-fit applications'}.`,
      '- Keep one short admin block for tracking, reminders, and follow-ups.',
      '- End the week by deciding what to stop, continue, and double down on.'
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
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
