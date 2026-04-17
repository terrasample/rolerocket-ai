document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('offerFile');
  const offerTextInput = document.getElementById('offerTextInput');
  const targetCompInput = document.getElementById('targetCompInput');
  const prioritiesInput = document.getElementById('negotiationPrioritiesInput');
  const generateBtn = document.getElementById('generateNegotiationCoachBtn');
  const resultWrap = document.getElementById('negotiationCoachResult');
  const downloadsWrap = document.getElementById('negotiationCoachDownloads');
  const pdfBtn = document.getElementById('downloadNegotiationCoachPdfBtn');
  const wordBtn = document.getElementById('downloadNegotiationCoachWordBtn');
  const textArea = document.getElementById('negotiationCoachText');
  const output = document.getElementById('negotiationCoachOutput');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function slugify(value) {
    return String(value || 'offer-negotiation-plan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'offer-negotiation-plan';
  }

  function getFileBaseName() {
    return slugify(`offer-negotiation-${targetCompInput?.value || 'plan'}`);
  }

  function formatPdf(text, doc) {
    let y = 24;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('Offer Negotiation Coaching Plan', 20, y);
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
      const formData = new FormData();
      if (fileInput?.files?.[0]) {
        formData.append('offerFile', fileInput.files[0]);
      }
      formData.append('offerText', offerTextInput?.value || '');
      formData.append('targetComp', targetCompInput?.value || '');
      formData.append('priorities', prioritiesInput?.value || '');

      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating Advice...';
      setMessage('', '#16a34a');

      try {
        const response = await fetch('/api/offer-negotiation-coach/analyze', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not generate negotiation advice.');
        }

        textArea.value = data.report || '';
        resultWrap.style.display = 'block';
        downloadsWrap.style.display = 'block';
        setMessage('Negotiation advice generated and ready to download.', '#16a34a');
      } catch (error) {
        setMessage(error.message || 'Could not generate negotiation advice.', '#dc2626');
      } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Negotiation Advice';
      }
    };
  }

  if (pdfBtn) {
    pdfBtn.onclick = function () {
      const text = textArea.value.trim();
      if (!text) {
        setMessage('Generate negotiation advice before downloading.', '#dc2626');
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
        setMessage('Generate negotiation advice before downloading.', '#dc2626');
        return;
      }

      const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 12pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
      downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
      setMessage('Word document downloaded.', '#16a34a');
    };
  }
});
