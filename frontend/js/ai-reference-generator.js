// AI Reference Generator Download Logic
    if (pdfBtn) {
      pdfBtn.onclick = function() {
        const text = textArea.value.trim();
        if (!text) {
          output.innerHTML += '<div style="color:#dc2626;">No reference letter to download.</div>';
          return;
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
          output.innerHTML += '<div style="color:#dc2626;">PDF library not loaded.</div>';
          return;
        }
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          formatReferenceGenForPdf(text, doc);
          doc.save('reference-letter.pdf');
          output.innerHTML += '<div style="color:#16a34a;">PDF downloaded.</div>';
        } catch (e) {
          output.innerHTML += '<div style="color:#dc2626;">PDF download failed.</div>';
        }
      };
    }
    if (wordBtn) {
      wordBtn.onclick = function() {
        const text = textArea.value.trim();
        if (!text) {
          output.innerHTML += '<div style="color:#dc2626;">No reference letter to download.</div>';
          return;
        }
        try {
          const content = 'Reference Letter\n\n' + text;
          const blob = new Blob([content], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'reference-letter.doc';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          output.innerHTML += '<div style="color:#16a34a;">Word document downloaded.</div>';
        } catch (e) {
          output.innerHTML += '<div style="color:#dc2626;">Word download failed.</div>';
        }
      };
    }
        splitLines.forEach(wrapLine => {
          doc.text(wrapLine, 25, y);
          y += lineHeight / 1.5;
        });
      }
      if (y > 270) { doc.addPage(); y = 28; }
    });
  }

  function bindDownloadButtons() {
    pdfBtn = document.getElementById('downloadReferenceGenPdfBtn');
    wordBtn = document.getElementById('downloadReferenceGenWordBtn');
    // Always get the latest textarea (may be re-rendered)
    textArea = document.getElementById('referenceGenText');
    if (pdfBtn) {
      pdfBtn.onclick = function() {
        const ta = document.getElementById('referenceGenText');
        const text = ta ? ta.value.trim() : '';
        if (!text) {
          output.innerHTML += '<div style="color:#dc2626;">No reference letter to download.</div>';
          return;
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
          output.innerHTML += '<div style="color:#dc2626;">PDF library not loaded.</div>';
          return;
        }
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          formatReferenceGenForPdf(text, doc);
          doc.save('reference-letter.pdf');
          output.innerHTML += '<div style="color:#16a34a;">PDF downloaded.</div>';
        } catch (e) {
          output.innerHTML += '<div style="color:#dc2626;">PDF download failed.</div>';
        }
      };
    }
    if (wordBtn) {
      wordBtn.onclick = function() {
        const ta = document.getElementById('referenceGenText');
        const text = ta ? ta.value.trim() : '';
        if (!text) {
          output.innerHTML += '<div style="color:#dc2626;">No reference letter to download.</div>';
          return;
        }
        try {
          const content = 'Reference Letter\n\n' + text;
          const blob = new Blob([content], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'reference-letter.doc';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);
          output.innerHTML += '<div style="color:#16a34a;">Word document downloaded.</div>';
        } catch (e) {
          output.innerHTML += '<div style="color:#dc2626;">Word download failed.</div>';
        }
      };
    }
  }
  bindDownloadButtons();

  // --- Reference Generation CTA logic ---
  if (startBtn && container) {
    startBtn.onclick = function() {
      startBtn.style.display = 'none';
      container.style.display = 'none';
      output.innerHTML = '';

      // Simple form for reference details
      output.innerHTML = `<div style='margin:18px 0;'>
        <strong>Reference Generator</strong><br>
        <label>Name to Recommend:<br><input id='refName' style='width:80%;margin:6px 0;'></label><br>
        <label>Position:<br><input id='refPosition' style='width:80%;margin:6px 0;'></label><br>
        <label>Your Name:<br><input id='refYourName' style='width:80%;margin:6px 0;'></label><br>
        <button id='generateRefBtn' class='feature-launch-btn' style='margin-top:10px;'>Generate Reference Letter</button>
      </div>`;
      document.getElementById('generateRefBtn').onclick = function() {
        const name = document.getElementById('refName').value || 'Jane Doe';
        const pos = document.getElementById('refPosition').value || 'Product Manager';
        const your = document.getElementById('refYourName').value || 'John Smith';
        // Generate a longer, more detailed reference letter (3+ paragraphs)
        const letter = `To Whom It May Concern,\n\nI am pleased to recommend ${name} for the position of ${pos}. During their time at our company, ${name} consistently demonstrated exceptional leadership, initiative, and a strong work ethic. Their ability to take on new challenges and deliver results exceeded expectations.\n\n${name} was instrumental in driving key projects to success, collaborating effectively with team members and stakeholders. Their communication skills, attention to detail, and commitment to excellence made a significant positive impact on our organization.\n\nBeyond their professional achievements, ${name} is a person of great integrity and character. I am confident that they will bring the same level of dedication and excellence to any future role.\n\nSincerely,\n${your}`;
        output.innerHTML = `<div style='margin:18px 0;'><strong>Generated Reference Letter:</strong><br><textarea id='referenceGenText' style='width:100%;max-width:600px;height:180px;margin:12px 0;'>${letter}</textarea><br>
        <div style='margin:18px 0;'>
          <button id='downloadReferenceGenPdfBtn' class='feature-launch-btn' style='margin-right:12px;'>Download as PDF</button>
          <button id='downloadReferenceGenWordBtn' class='feature-launch-btn'>Download as Word</button>
        </div>
        <button id='restartRefBtn' class='feature-launch-btn'>Start Again</button></div>`;
        // Re-bind download buttons for the generated letter
        bindDownloadButtons();
        document.getElementById('restartRefBtn').onclick = function() {
          output.innerHTML = '';
          startBtn.style.display = '';
          container.style.display = '';
        };
      };
    };
  }
});
