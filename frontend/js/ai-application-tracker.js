document.addEventListener('DOMContentLoaded', function () {
  const applicationsInput = document.getElementById('trackerApplicationsInput');
  const focusInput = document.getElementById('trackerFocusInput');
  const generateBtn = document.getElementById('generateApplicationTrackerBtn');
  const resultWrap = document.getElementById('applicationTrackerResult');
  const downloadsWrap = document.getElementById('applicationTrackerDownloads');
  const pdfBtn = document.getElementById('downloadApplicationTrackerPdfBtn');
  const wordBtn = document.getElementById('downloadApplicationTrackerWordBtn');
  const textArea = document.getElementById('applicationTrackerText');
  const output = document.getElementById('applicationTrackerOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'application-tracker')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'application-tracker';
  }

  function getFileBaseName() {
    return slugify(`${focusInput?.value || 'application'}-tracker`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('AI Application Tracker', 20, y);
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

  function parseApplications(rawValue) {
    return String(rawValue || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function categorizeApplications(entries) {
    const summary = {
      interview: 0,
      offer: 0,
      waiting: 0,
      rejected: 0
    };

    entries.forEach((entry) => {
      const lower = entry.toLowerCase();
      if (lower.includes('offer')) {
        summary.offer += 1;
      } else if (lower.includes('interview')) {
        summary.interview += 1;
      } else if (lower.includes('reject')) {
        summary.rejected += 1;
      } else {
        summary.waiting += 1;
      }
    });

    return summary;
  }

  function buildTracker(entries, focus) {
    const summary = categorizeApplications(entries);
    const nextActions = entries.slice(0, 3).map((entry, index) => `- Priority ${index + 1}: Follow up or prep next step for ${entry}.`);

    return [
      'AI Application Tracker Summary',
      '',
      `Active applications logged: ${entries.length}`,
      `Interviews in motion: ${summary.interview}`,
      `Offers pending or received: ${summary.offer}`,
      `Waiting for response: ${summary.waiting}`,
      `Closed or rejected: ${summary.rejected}`,
      '',
      `Current focus: ${focus || 'Keep the pipeline moving and improve conversion.'}`,
      '',
      'Recommended next actions:',
      ...(nextActions.length ? nextActions : ['- Add at least three applications to generate a more useful action queue.']),
      '- Rebalance effort toward the stage where the most applications are currently stuck.',
      '- Schedule follow-up blocks twice a week so no application goes stale.'
    ].join('\n');
  }

  if (generateBtn) {
    generateBtn.onclick = function () {
      const entries = parseApplications(applicationsInput?.value);
      if (!entries.length) {
        setMessage('Add at least one application entry before generating the tracker.', '#dc2626');
        return;
      }

      textArea.value = buildTracker(entries, focusInput?.value.trim());
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Application tracker summary generated and ready to download.', '#16a34a');
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate the summary before downloading.', '#dc2626');
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
        setMessage('Generate the summary before downloading.', '#dc2626');
        return;
      }
      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
