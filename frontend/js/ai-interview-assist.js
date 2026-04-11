// AI Interview Assist Frontend Logic
// Handles the interview flow: start, Q&A, and feedback

document.addEventListener('DOMContentLoaded', function () {
  const startBtn = document.getElementById('startInterviewBtn');
  const startAudioBtn = document.getElementById('startAudioBtn');
  const roleInput = document.getElementById('interviewRole');
  const scenarioInput = document.getElementById('interviewScenario');
  const resultDiv = document.getElementById('interviewAssistResult');
  const localAudio = document.getElementById('localAudio');

  // AUDIO INTERVIEW PRACTICE
  if (startAudioBtn) {
    startAudioBtn.addEventListener('click', async function() {
      startAudioBtn.disabled = true;
      resultDiv.innerHTML = '<em>Starting audio interview...</em>';
      try {
        if (!window.AIInterviewAudio) throw new Error('Audio module not loaded.');
        await window.AIInterviewAudio.startAudioStream();
        // Optionally play back local audio
        // localAudio.srcObject = localStream;
        // Get first question from backend
        const role = roleInput.value.trim();
        const scenario = scenarioInput.value.trim();
        let token = '';
        if (typeof getStoredToken === 'function') {
          token = getStoredToken();
        } else if (typeof getAuthToken === 'function') {
          token = getAuthToken();
        } else if (window.getStoredToken) {
          token = window.getStoredToken();
        } else if (window.getAuthToken) {
          token = window.getAuthToken();
        } else {
          token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
        }
        const res = await fetch('/api/interview-assist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ role, scenario })
        });
        const data = await res.json();
        if (data.firstQuestion) {
          resultDiv.innerHTML = `<strong>AI:</strong> ${data.firstQuestion}<br><em>Speak your answer after the beep...</em>`;
          window.AIInterviewAudio.speakText(data.firstQuestion);
          setTimeout(() => {
            if (!window.AIInterviewAudio.startSpeechRecognition) {
              resultDiv.innerHTML += '<br><span style="color:#dc2626;">Speech recognition not available in this browser.</span>';
              startAudioBtn.disabled = false;
              return;
            }
            window.AIInterviewAudio.startSpeechRecognition(async (transcript) => {
              resultDiv.innerHTML += `<br><strong>You:</strong> ${transcript}<br><em>AI is evaluating your answer...</em>`;
              // Send answer to backend for feedback
              const feedbackRes = await fetch('/api/interview-assist', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role, scenario, question: data.firstQuestion, answer: transcript })
              });
              const feedbackData = await feedbackRes.json();
              if (feedbackData.answer) {
                resultDiv.innerHTML += `<br><strong>AI Feedback:</strong> ${feedbackData.answer}`;
                window.AIInterviewAudio.speakText(feedbackData.answer);
              } else {
                resultDiv.innerHTML += `<br><span style='color:red;'>No feedback received.</span>`;
              }
              startAudioBtn.disabled = false;
            });
          }, 1200);
        } else {
          resultDiv.innerHTML = '<span style="color:#dc2626;">Failed to get interview question.</span>';
          startAudioBtn.disabled = false;
        }
      } catch (err) {
        resultDiv.innerHTML = `<span style='color:red;'>${err.message || err}</span>`;
        startAudioBtn.disabled = false;
      }
    });
  }

  let interviewState = {
    step: 0,
    questions: [],
    answers: [],
    feedback: null,
    sessionId: null
  };

  async function startInterview() {
    resultDiv.innerHTML = '<em>Starting interview...</em>';
    interviewState = { step: 0, questions: [], answers: [], feedback: null, sessionId: null };
    const role = roleInput.value.trim();
    const scenario = scenarioInput.value.trim();
    let token = '';
    if (typeof getStoredToken === 'function') {
      token = getStoredToken();
    } else if (typeof getAuthToken === 'function') {
      token = getAuthToken();
    } else if (window.getStoredToken) {
      token = window.getStoredToken();
    } else if (window.getAuthToken) {
      token = window.getAuthToken();
    } else {
      token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
    }
    if (!token) {
      resultDiv.innerHTML = '<span style="color:#dc2626;">You must be logged in to start an interview. Please log in and try again.</span>';
      return;
    }
    try {
      const res = await fetch('/api/interview-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role, scenario, step: 0, answers: [] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start interview');
      interviewState.sessionId = data.sessionId || null;
      interviewState.questions = data.questions || [];
      interviewState.step = 0;
      showQuestion();
    function formatInterviewForPdf(text, doc) {
      const lines = text.split(/\r?\n/);
      let y = 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Generated Interview Q&A', 10, y);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      lines.forEach(line => {
        if (/^### /.test(line)) {
          y += 8;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text(line.replace(/^### /, ''), 10, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          y += 6;
        } else if (/^## /.test(line)) {
          y += 8;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text(line.replace(/^## /, ''), 10, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          y += 5;
        } else if (/^# /.test(line)) {
          y += 10;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(15);
          doc.text(line.replace(/^# /, ''), 10, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          y += 6;
        } else if (/^\d+\. /.test(line)) {
          doc.text(line, 14, y);
          y += 6;
        } else if (/^- /.test(line)) {
          doc.text(line.replace(/^- /, '\u2022 '), 18, y);
          y += 6;
        } else if (/^\*\*.*\*\*$/.test(line)) {
          doc.setFont('helvetica', 'bold');
          doc.text(line.replace(/\*\*/g, ''), 10, y);
          doc.setFont('helvetica', 'normal');
          y += 6;
        } else if (line.trim() === '') {
          y += 4;
        } else {
          doc.text(line, 10, y);
          y += 6;
        }
        if (y > 270) { doc.addPage(); y = 20; }
      });
    }

    if (savePdfBtn) {
      savePdfBtn.onclick = function() {
        if (!lastResult) {
          output.innerHTML = '<div style="color:#dc2626;">No interview Q&A to save. Please generate first.</div>';
          return;
        }
        if (!window.jspdf) {
          output.innerHTML = '<div style="color:#dc2626;">PDF library not loaded.</div>';
          return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        formatInterviewForPdf(lastResult, doc);
        doc.save('interview-qa.pdf');
        output.innerHTML = '<div style="color:#16a34a;">PDF downloaded.</div>';
      };
    }

    function formatInterviewForWord(text) {
      return (
        'Generated Interview Q&A\n\n' +
        text
          .replace(/^### (.*)$/gm, '\n\n$1\n' + '-'.repeat(40))
          .replace(/^## (.*)$/gm, '\n\n$1\n' + '-'.repeat(30))
          .replace(/^# (.*)$/gm, '\n\n$1\n' + '-'.repeat(20))
          .replace(/\*\*(.*?)\*\*/g, '$1'.toUpperCase())
          .replace(/^- /gm, '  • ')
          .replace(/\n{2,}/g, '\n\n')
      );
    }

    if (saveWordBtn) {
      saveWordBtn.onclick = function() {
        if (!lastResult) {
          output.innerHTML = '<div style=\"color:#dc2626;\">No interview Q&A to save. Please generate first.</div>';
          return;
        }
        const content = formatInterviewForWord(lastResult);
        const blob = new Blob([content], { type: 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'interview-qa.doc';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        output.innerHTML = '<div style="color:#16a34a;">Word document downloaded.</div>';
      };
    }
  async function getFeedback() {
    try {
      const role = roleInput.value.trim();
      const scenario = scenarioInput.value.trim();
      let token = '';
      if (typeof getStoredToken === 'function') {
        token = getStoredToken();
      } else if (typeof getAuthToken === 'function') {
        token = getAuthToken();
      } else if (window.getStoredToken) {
        token = window.getStoredToken();
      } else if (window.getAuthToken) {
        token = window.getAuthToken();
      } else {
        token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '';
      }
      const res = await fetch('/api/interview-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          role,
          scenario,
          step: interviewState.step,
          answers: interviewState.answers,
          sessionId: interviewState.sessionId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get feedback');
      interviewState.feedback = data.feedback || 'No feedback received.';
      resultDiv.innerHTML = `<div style="margin-top:18px;"><strong>AI Feedback:</strong><br>${interviewState.feedback}</div>`;
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:red;">${err.message}</span>`;
    }
  }

  if (startBtn) {
    startBtn.addEventListener('click', startInterview);
  }
});

// Helper to get auth token from all possible sources
function getAuthToken() {
  try {
    return (
      (typeof getStoredToken === 'function' && getStoredToken()) ||
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('authToken') ||
      ''
    );
  } catch {
    return '';
  }
}
