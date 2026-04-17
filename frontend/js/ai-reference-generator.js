document.addEventListener('DOMContentLoaded', function () {
  const startBtn = document.getElementById('startReferenceGenBtn');
  const container = document.getElementById('referenceGenContainer');
  const output = document.getElementById('referenceGenOutput');
  const form = document.getElementById('referenceGenForm');
  const result = document.getElementById('referenceGenResult');
  const textArea = document.getElementById('referenceGenText');
  const downloadWrap = document.getElementById('referenceGenDownloads');
  const pdfBtn = document.getElementById('downloadReferenceGenPdfBtn');
  const wordBtn = document.getElementById('downloadReferenceGenWordBtn');
  const restartBtn = document.getElementById('restartRefBtn');
  const generateBtn = document.getElementById('generateRefBtn');

  function setMessage(message, color) {
    if (!output) {
      return;
    }
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugifyFileName(value) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'reference-letter';
  }

  function buildReferenceLetter() {
    const name = (document.getElementById('refName')?.value || '').trim() || 'Jane Doe';
    const position = (document.getElementById('refPosition')?.value || '').trim() || 'Product Manager';
    const relationship = (document.getElementById('refRelationship')?.value || '').trim() || 'a direct report on a high-visibility team';
    const strengths = (document.getElementById('refStrengths')?.value || '').trim() || 'leadership, initiative, communication, and dependable execution';
    const yourName = (document.getElementById('refYourName')?.value || '').trim() || 'John Smith';

    return `To Whom It May Concern,\n\nI am pleased to recommend ${name} for the position of ${position}. I had the opportunity to work with ${name} as ${relationship}, and throughout that time ${name} consistently demonstrated ${strengths}.\n\n${name} approaches work with professionalism, sound judgment, and a strong sense of ownership. They communicate clearly, collaborate effectively with others, and follow through on commitments with a level of consistency that makes them highly reliable in fast-moving environments.\n\nWhat stands out most is ${name}'s ability to adapt to new challenges while maintaining a positive attitude and a high standard of work. I am confident ${name} will make a strong contribution in this role and would be an asset to any organization fortunate enough to have them.\n\nSincerely,\n${yourName}`;
  }

  function formatReferenceGenForPdf(text, doc) {
    const marginLeft = 20;
    const lineHeight = 8;
    let y = 24;

    doc.setFont('times', 'normal');
    doc.setFontSize(12);

    text.split('\n').forEach((line) => {
      const printable = line.trim() ? doc.splitTextToSize(line, 170) : [''];
      printable.forEach((wrappedLine) => {
        if (y > 275) {
          doc.addPage();
          y = 24;
        }
        doc.text(wrappedLine, marginLeft, y);
        y += lineHeight;
      });
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function getCurrentLetter() {
    return textArea ? textArea.value.trim() : '';
  }

  function getCurrentFileBaseName() {
    const recommendedName = (document.getElementById('refName')?.value || '').trim();
    return `${slugifyFileName(recommendedName || 'reference-letter')}-reference-letter`;
  }

  if (startBtn && container) {
    startBtn.onclick = function () {
      startBtn.style.display = 'none';
      container.style.display = 'block';
      if (form) {
        form.style.display = 'block';
      }
      if (result) {
        result.style.display = 'none';
      }
      if (downloadWrap) {
        downloadWrap.style.display = 'none';
      }
      setMessage('', '#16a34a');
    };
  }

  if (generateBtn && result && textArea && downloadWrap) {
    generateBtn.onclick = function () {
      const letter = buildReferenceLetter();
      textArea.value = letter;
      result.style.display = 'block';
      downloadWrap.style.display = 'block';
      setMessage('Reference letter generated and ready to download.', '#16a34a');
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = getCurrentLetter();
      if (!text) {
        setMessage('Generate the reference letter before downloading.', '#dc2626');
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        setMessage('PDF library not loaded.', '#dc2626');
        return;
      }

      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        formatReferenceGenForPdf(text, doc);
        doc.save(`${getCurrentFileBaseName()}.pdf`);
        setMessage('PDF downloaded.', '#16a34a');
      } catch (error) {
        setMessage('PDF download failed.', '#dc2626');
      }
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function () {
      const text = getCurrentLetter();
      if (!text) {
        setMessage('Generate the reference letter before downloading.', '#dc2626');
        return;
      }

      try {
        const htmlDocument = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text
          .split('\n')
          .map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`)
          .join('')}</body></html>`;
        const blob = new Blob(['\ufeff', htmlDocument], {
          type: 'application/msword;charset=utf-8'
        });
        downloadBlob(blob, `${getCurrentFileBaseName()}.doc`);
        setMessage('Word document downloaded.', '#16a34a');
      } catch (error) {
        setMessage('Word download failed.', '#dc2626');
      }
    };
  }

  if (restartBtn && startBtn && container && form && result && downloadWrap && textArea) {
    restartBtn.onclick = function () {
      container.style.display = 'none';
      form.style.display = 'block';
      result.style.display = 'none';
      downloadWrap.style.display = 'none';
      textArea.value = '';
      startBtn.style.display = '';
      setMessage('', '#16a34a');
    };
  }
});
