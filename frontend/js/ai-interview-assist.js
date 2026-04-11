// AI Interview Assist Frontend Logic
// Handles the interview flow: start, Q&A, and feedback

document.addEventListener('DOMContentLoaded', function () {
  const startBtn = document.getElementById('startInterviewBtn');
  const roleInput = document.getElementById('interviewRole');
  const scenarioInput = document.getElementById('interviewScenario');
  const resultDiv = document.getElementById('interviewAssistResult');

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
    let token = null;
    if (typeof getAuthToken === 'function') {
      token = getAuthToken();
    } else if (window.getAuthToken) {
      token = window.getAuthToken();
    } else {
      token = localStorage.getItem('token');
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
    } catch (err) {
      resultDiv.innerHTML = `<span style=\"color:red;\">${err.message}</span>`;
    }
  }

  function showQuestion() {
    const q = interviewState.questions[interviewState.step];
    if (!q) {
      resultDiv.innerHTML = '<em>No more questions. Generating feedback...</em>';
      getFeedback();
      return;
    }
    resultDiv.innerHTML = `
      <div><strong>Question ${interviewState.step + 1}:</strong> ${q}</div>
      <textarea id="answerInput" rows="4" style="width:100%;margin-top:12px;"></textarea>
      <button id="submitAnswerBtn" style="margin-top:10px;">Submit Answer</button>
    `;
    document.getElementById('submitAnswerBtn').onclick = submitAnswer;
  }

  async function submitAnswer() {
    const answer = document.getElementById('answerInput').value.trim();
    if (!answer) {
      alert('Please enter your answer.');
      return;
    }
    interviewState.answers.push(answer);
    interviewState.step++;
    // If more questions, show next; else, get feedback
    if (interviewState.step < interviewState.questions.length) {
      showQuestion();
    } else {
      resultDiv.innerHTML = '<em>Generating feedback...</em>';
      getFeedback();
    }
  }

  async function getFeedback() {
    try {
      const role = roleInput.value.trim();
      const scenario = scenarioInput.value.trim();
      const res = await fetch('/api/interview-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthToken() ? `Bearer ${getAuthToken()}` : ''
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

  startBtn.addEventListener('click', startInterview);
});

// Helper to get auth token from localStorage (if available)
function getAuthToken() {
  try {
    return localStorage.getItem('authToken') || '';
  } catch {
    return '';
  }
}
