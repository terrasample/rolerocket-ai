// Video Interview Practice Download Logic

document.addEventListener('DOMContentLoaded', async function () {
  const pdfBtn = document.getElementById('downloadVideoInterviewPdfBtn');
  const wordBtn = document.getElementById('downloadVideoInterviewWordBtn');
  const textArea = document.getElementById('videoInterviewText');
  const output = document.getElementById('videoInterviewOutput');
  const startBtn = document.getElementById('startInterviewBtn');
  const practiceContainer = document.getElementById('interviewPracticeContainer');

  // Personalized report fetch logic
  const token = localStorage.getItem('token');
  if (token && typeof apiUrl === 'function') {
    try {
      const res = await fetch(apiUrl('/api/video-interview-practice'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.report) {
          textArea.value = data.report;
        }
      }
    } catch (e) { /* fallback to sample */ }
  }

  function formatVideoInterviewForPdf(text, doc) {
    const lines = text.split(/\r?\n/);
    let y = 28;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.text('Video Interview Feedback', 25, y);
    y += 24;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const lineHeight = 24;
    lines.forEach(line => {
      if (/^\s*$/.test(line)) {
        y += lineHeight / 2;
      } else {
        const splitLines = doc.splitTextToSize(line, 160);
        splitLines.forEach(wrapLine => {
          doc.text(wrapLine, 25, y);
          y += lineHeight / 1.5;
        });
      }
      if (y > 270) { doc.addPage(); y = 28; }
    });
  }

  if (pdfBtn) {
    pdfBtn.onclick = function() {
      const text = textArea.value.trim();
      if (!text) {
        output.innerHTML = '<div style="color:#dc2626;">No feedback to download.</div>';
        return;
      }
      if (!window.jspdf) {
        output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      formatVideoInterviewForPdf(text, doc);
      doc.save('video-interview-feedback.pdf');
      output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
    };
  }

  if (wordBtn) {
    wordBtn.onclick = function() {
      const text = textArea.value.trim();
      if (!text) {
        output.innerHTML = '<div style="color:#dc2626;">No feedback to download.</div>';
        return;
      }
      const content = 'Video Interview Feedback\n\n' + text;
      const blob = new Blob([content], { type: 'application/msword' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'video-interview-feedback.doc';
      a.click();
      output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
    };
  }

  // --- Interview Practice CTA logic ---
  if (startBtn && practiceContainer) {
    startBtn.onclick = function() {
      startBtn.style.display = 'none';
      practiceContainer.style.display = 'none';
      output.innerHTML = '';

      // Mock interview flow
      const questions = [
        'Tell me about yourself.',
        'Describe a challenge you faced at work and how you handled it.',
        'Why are you interested in this role?',
        'What is your greatest strength?',
        'Do you have any questions for us?'
      ];
      let current = 0;
      let answers = [];

      function showQuestion() {
        if (current >= questions.length) {
          // Simulate feedback
          setTimeout(() => {
            output.innerHTML = `<div style="margin:18px 0;"><strong>AI Feedback:</strong><br>Great job! You communicated clearly and provided relevant examples. For even better results, try to be more concise and use the STAR method for behavioral questions.<br><br><button id='restartInterviewBtn' class='feature-launch-btn'>Practice Again</button></div>`;
            document.getElementById('restartInterviewBtn').onclick = function() {
              output.innerHTML = '';
              startBtn.style.display = '';
              practiceContainer.style.display = '';
            };
          }, 1200);
          return;
        }
        output.innerHTML = `<div style='margin:18px 0;'><strong>Interview Question ${current+1}:</strong><br>${questions[current]}<br><textarea id='answerBox' style='width:100%;max-width:600px;height:80px;margin:12px 0;'></textarea><br><button id='submitAnswerBtn' class='feature-launch-btn'>Submit Answer</button></div>`;
        document.getElementById('submitAnswerBtn').onclick = function() {
          const answer = document.getElementById('answerBox').value.trim();
          answers.push({ q: questions[current], a: answer });
          current++;
          showQuestion();
        };
      }
      showQuestion();
    };
  }
});
