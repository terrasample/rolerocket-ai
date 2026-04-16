// AI Interview Assist Frontend Logic
// Handles text and audio interview practice flows.

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startInterviewBtn');
  const startAudioBtn = document.getElementById('startAudioBtn');
  const roleInput = document.getElementById('interviewRole');
  const scenarioInput = document.getElementById('interviewScenario');
  const resultDiv = document.getElementById('interviewAssistResult');

  function getToken() {
    if (typeof getStoredToken === 'function') return getStoredToken() || '';
    if (typeof getAuthToken === 'function') return getAuthToken() || '';
    if (typeof window.getStoredToken === 'function') return window.getStoredToken() || '';
    if (typeof window.getAuthToken === 'function') return window.getAuthToken() || '';
    return localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderFeedbackMarkup(data) {
    const bullets = Array.isArray(data?.bullets) ? data.bullets : [];
    const bulletMarkup = bullets.length
      ? bullets.map((item, index) => `<li style="margin-bottom:6px;"><strong>Prompt ${index + 1}:</strong> ${escapeHtml(item)}</li>`).join('')
      : '<li>No quick prompts returned.</li>';

    const structureLabel = String(data?.type || 'general').trim() || 'general';
    const structureText = structureLabel === 'behavioral'
      ? 'Use STAR: situation, task, action, result.'
      : structureLabel === 'situational'
        ? 'Answer with a direct approach, key action, and expected outcome.'
        : 'Lead with your point, support it briefly, then close confidently.';

    return `
      <div style="margin-top:14px;padding:16px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff;">
        <div style="font-size:0.8rem;font-weight:700;color:#1d4ed8;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">What it does</div>
        <div style="margin-bottom:12px;">
          <strong>Prompts</strong>
          <ul style="margin:8px 0 0 18px;padding:0;">${bulletMarkup}</ul>
        </div>
        <div style="margin-bottom:12px;">
          <strong>Structure</strong>
          <div style="margin-top:6px;color:#334155;">${escapeHtml(structureText)}</div>
        </div>
        <div>
          <strong>Reminder</strong>
          <div style="margin-top:6px;color:#334155;">${escapeHtml(data?.tip || 'Pause, breathe, and land the main point first.')}</div>
        </div>
      </div>
      <div style="margin-top:14px;padding:16px;border:1px solid #dcfce7;border-radius:12px;background:#f7fff9;">
        <div style="font-size:0.8rem;font-weight:700;color:#15803d;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">What it does for you</div>
        <div style="color:#334155;line-height:1.8;">👉 Prevents freezing</div>
        <div style="color:#334155;line-height:1.8;">👉 Keeps answers sharp</div>
      </div>
      <div style="margin-top:14px;">
        <strong>Answer Draft</strong>
        <div style="margin-top:8px;line-height:1.8;color:#0f172a;">${escapeHtml(data?.answer || '')}</div>
      </div>
    `;
  }

  async function postInterviewAssist(body) {
    const token = getToken();
    if (!token) {
      throw new Error('You must be logged in to use Interview Assist.');
    }

    const res = await fetch('/api/interview-assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Interview Assist request failed.');
    }
    return data;
  }

  async function startInterview() {
    const role = (roleInput?.value || '').trim();
    const scenario = (scenarioInput?.value || '').trim();

    resultDiv.innerHTML = '<em>Starting interview...</em>';

    try {
      const data = await postInterviewAssist({ role, scenario });
      const firstQuestion = String(data.firstQuestion || '').trim();
      if (!firstQuestion) {
        resultDiv.innerHTML = '<span style="color:#dc2626;">No interview question was returned.</span>';
        return;
      }

      resultDiv.innerHTML = `
        <div style="margin-bottom:10px;"><strong>AI:</strong> ${escapeHtml(firstQuestion)}</div>
        <label for="interviewAnswerInput" style="display:block;font-weight:600;margin-bottom:6px;">Your Answer</label>
        <textarea id="interviewAnswerInput" rows="5" style="width:100%;margin-bottom:10px;" placeholder="Type your answer here..."></textarea>
        <button id="submitInterviewAnswerBtn" class="auth-submit-btn" style="width:100%;">Submit Answer for Feedback</button>
        <div id="interviewFeedbackResult" style="margin-top:12px;"></div>
      `;

      const submitBtn = document.getElementById('submitInterviewAnswerBtn');
      const answerInput = document.getElementById('interviewAnswerInput');
      const feedbackDiv = document.getElementById('interviewFeedbackResult');

      submitBtn?.addEventListener('click', async () => {
        const answer = (answerInput?.value || '').trim();
        if (!answer) {
          feedbackDiv.innerHTML = '<span style="color:#dc2626;">Please enter your answer first.</span>';
          return;
        }

        submitBtn.disabled = true;
        feedbackDiv.innerHTML = '<em>AI is evaluating your answer...</em>';

        try {
          const feedbackData = await postInterviewAssist({
            role,
            scenario,
            question: firstQuestion,
            answer
          });

          feedbackDiv.innerHTML = feedbackData.answer
            ? renderFeedbackMarkup(feedbackData)
            : '<span style="color:#dc2626;">No feedback received.</span>';

          if (feedbackData.answer && window.RoleRocketQuickstart) {
            window.RoleRocketQuickstart.completeStep('interview', 'interview_feedback_text');
          }
        } catch (err) {
          feedbackDiv.innerHTML = `<span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
        } finally {
          submitBtn.disabled = false;
        }
      });
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
    }
  }

  async function startAudioPractice() {
    const role = (roleInput?.value || '').trim();
    const scenario = (scenarioInput?.value || '').trim();

    startAudioBtn.disabled = true;
    resultDiv.innerHTML = '<em>Starting audio interview...</em>';

    try {
      if (!window.AIInterviewAudio) {
        throw new Error('Audio module is not loaded. Please refresh and try again.');
      }

      await window.AIInterviewAudio.startAudioStream();
      const data = await postInterviewAssist({ role, scenario });
      const firstQuestion = String(data.firstQuestion || '').trim();

      if (!firstQuestion) {
        throw new Error('Failed to get interview question.');
      }

      resultDiv.innerHTML = `<strong>AI:</strong> ${escapeHtml(firstQuestion)}<br><em>Speak your answer after the beep...</em>`;
      window.AIInterviewAudio.speakText(firstQuestion);

      setTimeout(() => {
        if (!window.AIInterviewAudio.startSpeechRecognition) {
          resultDiv.innerHTML += '<br><span style="color:#dc2626;">Speech recognition is not available in this browser.</span>';
          startAudioBtn.disabled = false;
          return;
        }

        window.AIInterviewAudio.startSpeechRecognition(async (transcript) => {
          resultDiv.innerHTML += `<br><strong>You:</strong> ${escapeHtml(transcript)}<br><em>AI is evaluating your answer...</em>`;

          try {
            const feedbackData = await postInterviewAssist({
              role,
              scenario,
              question: firstQuestion,
              answer: transcript
            });

            if (feedbackData.answer) {
              resultDiv.innerHTML += `<div style="margin-top:12px;">${renderFeedbackMarkup(feedbackData)}</div>`;
              window.AIInterviewAudio.speakText(feedbackData.answer);
              if (window.RoleRocketQuickstart) {
                window.RoleRocketQuickstart.completeStep('interview', 'interview_feedback_audio');
              }
            } else {
              resultDiv.innerHTML += '<br><span style="color:#dc2626;">No feedback received.</span>';
            }
          } catch (err) {
            resultDiv.innerHTML += `<br><span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
          } finally {
            startAudioBtn.disabled = false;
          }
        });
      }, 1000);
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
      startAudioBtn.disabled = false;
    }
  }

  startBtn?.addEventListener('click', startInterview);
  startAudioBtn?.addEventListener('click', startAudioPractice);
});
