// AI Interview Assist Frontend Logic
// Handles text and audio interview practice flows.

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startInterviewBtn');
  const startAudioBtn = document.getElementById('startAudioBtn');
  const liveAnswerBtn = document.getElementById('getLiveAnswerBtn');
  const startLiveCaptureBtn = document.getElementById('startLiveCaptureBtn');
  const stopLiveCaptureBtn = document.getElementById('stopLiveCaptureBtn');
  const liveCaptureStatus = document.getElementById('liveCaptureStatus');
  const roleInput = document.getElementById('interviewRole');
  const scenarioInput = document.getElementById('interviewScenario');
  const liveQuestionInput = document.getElementById('liveQuestionInput');
  const resultDiv = document.getElementById('interviewAssistResult');
  const practiceLimitBanner = document.getElementById('interviewPracticeLimitBanner');
  let liveListenerEnabled = false;
  let liveDebounceTimer = null;
  let pendingTranscript = '';
  let liveInFlight = false;
  let liveTranscriptionQueue = Promise.resolve();
  let lastTranscriptChunk = '';
  let currentPlan = 'free';
  let practiceCount = 0;
  let practiceKey = 'rr_interview_practice_count_free';

  function normalizePlan(plan) {
    const normalized = String(plan || 'free').toLowerCase();
    return ['free', 'pro', 'premium', 'elite', 'lifetime'].includes(normalized) ? normalized : 'free';
  }

  function canUseUnlimitedPractice() {
    return normalizePlan(currentPlan) !== 'free';
  }

  function isPracticeBlocked() {
    return !canUseUnlimitedPractice() && practiceCount >= 1;
  }

  function setPracticeButtonsDisabled(disabled) {
    [startBtn, startAudioBtn, liveAnswerBtn, startLiveCaptureBtn].forEach((button) => {
      if (button) button.disabled = disabled;
    });
    if (disabled && stopLiveCaptureBtn) stopLiveCaptureBtn.disabled = true;
  }

  function renderPracticeAccessBanner() {
    if (!practiceLimitBanner) return;

    if (canUseUnlimitedPractice()) {
      practiceLimitBanner.style.display = 'block';
      practiceLimitBanner.style.background = '#ecfdf5';
      practiceLimitBanner.style.borderColor = '#86efac';
      practiceLimitBanner.style.color = '#166534';
      practiceLimitBanner.innerHTML = `Your ${escapeHtml(String(currentPlan).toUpperCase())} plan includes ongoing interview practice.`;
      setPracticeButtonsDisabled(false);
      return;
    }

    practiceLimitBanner.style.display = 'block';
    if (isPracticeBlocked()) {
      practiceLimitBanner.style.background = '#fff7ed';
      practiceLimitBanner.style.borderColor = '#fdba74';
      practiceLimitBanner.style.color = '#9a3412';
      practiceLimitBanner.innerHTML = 'You have used your free practice question. Upgrade your plan to keep practicing more hard questions.';
      setPracticeButtonsDisabled(true);
      stopLiveListening();
    } else {
      practiceLimitBanner.style.background = '#eff6ff';
      practiceLimitBanner.style.borderColor = '#bfdbfe';
      practiceLimitBanner.style.color = '#1e3a8a';
      practiceLimitBanner.innerHTML = 'Free plan includes 1 interview practice question. Paid plans unlock ongoing practice.';
      setPracticeButtonsDisabled(false);
    }
  }

  function incrementPracticeCount() {
    if (canUseUnlimitedPractice()) return;
    practiceCount += 1;
    localStorage.setItem(practiceKey, String(practiceCount));
    renderPracticeAccessBanner();
  }

  async function loadPracticeAccess() {
    const token = getToken();
    if (!token) {
      renderPracticeAccessBanner();
      return;
    }

    try {
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      currentPlan = normalizePlan(data?.user?.plan || 'free');
      const identityKey = String(data?.user?.email || data?.user?._id || 'free-user').toLowerCase();
      practiceKey = `rr_interview_practice_count_${identityKey}`;
      practiceCount = Number(localStorage.getItem(practiceKey) || '0');
    } catch (err) {
      currentPlan = 'free';
      practiceCount = Number(localStorage.getItem(practiceKey) || '0');
    }

    renderPracticeAccessBanner();
  }

  function setLiveStatus(text, color = '#475569') {
    if (!liveCaptureStatus) return;
    liveCaptureStatus.textContent = text;
    liveCaptureStatus.style.color = color;
  }

  function setLiveButtons(listening) {
    if (startLiveCaptureBtn) startLiveCaptureBtn.disabled = listening;
    if (stopLiveCaptureBtn) stopLiveCaptureBtn.disabled = !listening;
  }

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
    const coachPointers = Array.isArray(data?.coachPointers) ? data.coachPointers : [];
    const bulletMarkup = bullets.length
      ? bullets.map((item, index) => `<li style="margin-bottom:6px;"><strong>Prompt ${index + 1}:</strong> ${escapeHtml(item)}</li>`).join('')
      : '<li>No quick prompts returned.</li>';
    const pointerMarkup = coachPointers.length
      ? coachPointers.map((item) => `<li style="margin-bottom:6px;">${escapeHtml(item)}</li>`).join('')
      : '<li>Slow down, pause one beat, then lead with your strongest point.</li>';

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
      <div style="margin-top:14px;padding:16px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;">
        <div style="font-size:0.8rem;font-weight:700;color:#92400e;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">Live delivery coach</div>
        <ul style="margin:8px 0 0 18px;padding:0;">${pointerMarkup}</ul>
      </div>
      <div style="margin-top:14px;padding:16px;border:1px solid #dcfce7;border-radius:12px;background:#f7fff9;">
        <div style="font-size:0.8rem;font-weight:700;color:#15803d;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;">What it does for you</div>
        <div style="color:#334155;line-height:1.8;">👉 Prevents freezing</div>
        <div style="color:#334155;line-height:1.8;">👉 Keeps answers sharp</div>
      </div>
      <div style="margin-top:14px;padding:12px 14px;border:1px solid #fbcfe8;border-radius:12px;background:#fdf2f8;">
        <strong>If you blank out:</strong>
        <div style="margin-top:6px;color:#4b5563;">${escapeHtml(data?.freezeRescue || 'Give me one second to think. The key point is: [state your main point first].')}</div>
      </div>
      <div style="margin-top:14px;">
        <strong>Live Answer Draft</strong>
        <div style="margin-top:8px;line-height:1.8;color:#0f172a;">${escapeHtml(data?.answer || '')}</div>
      </div>
    `;
  }

  function renderInstantAnswerMarkup(question, role) {
    const rolePrefix = role ? `For this ${escapeHtml(role)} interview, ` : '';
    return `
      <div style="margin-top:14px;padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;">
        <div style="font-size:0.8rem;font-weight:700;color:#1d4ed8;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">Instant speak-now line</div>
        <div style="color:#1e3a8a;line-height:1.7;">${rolePrefix}I would approach this by focusing on the highest-impact action first, then giving one clear example that shows outcome.</div>
        <div style="margin-top:8px;color:#475569;font-size:0.92rem;">Detected recruiter question: ${escapeHtml(question)}</div>
      </div>
      <div style="margin-top:10px;color:#475569;"><em>Refining with customized response...</em></div>
    `;
  }

  function looksLikeQuestion(text) {
    const q = String(text || '').trim().toLowerCase();
    if (!q || q.length < 15) return false;
    if (q.endsWith('?')) return true;
    return /^(how|what|why|when|where|can you|could you|would you|tell me|walk me|describe|give me)/.test(q);
  }

  function getLatestQuestionCandidate(text) {
    const parts = String(text || '')
      .split(/(?<=[?.!])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (looksLikeQuestion(parts[i])) return parts[i];
    }

    return parts.length ? parts[parts.length - 1] : '';
  }

  function appendTranscriptForDetection(text) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    if (normalized === lastTranscriptChunk) return;

    lastTranscriptChunk = normalized;
    pendingTranscript = `${pendingTranscript} ${normalized}`.trim();

    if (liveDebounceTimer) clearTimeout(liveDebounceTimer);
    liveDebounceTimer = setTimeout(() => {
      const candidate = getLatestQuestionCandidate(pendingTranscript);
      pendingTranscript = '';

      if (looksLikeQuestion(candidate)) {
        resolveLiveQuestion(candidate, Date.now());
      } else if (candidate) {
        setLiveStatus(`Listening... ${candidate.slice(-90)}`, '#0f766e');
      }
    }, 900);
  }

  async function transcribeLiveAudioChunk(blob) {
    const token = getToken();
    if (!token) {
      throw new Error('You must be logged in to use Interview Assist.');
    }

    const extension = blob.type && blob.type.includes('mp4')
      ? 'mp4'
      : blob.type && blob.type.includes('ogg')
        ? 'ogg'
        : 'webm';

    const formData = new FormData();
    formData.append('audio', blob, `interview-live.${extension}`);

    const res = await fetch('/api/interview-assist/transcribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Live transcription failed.');
    }

    return String(data.text || '').trim();
  }

  function queueLiveTranscription(blob) {
    liveTranscriptionQueue = liveTranscriptionQueue
      .then(async () => {
        if (!liveListenerEnabled) return;
        const transcript = await transcribeLiveAudioChunk(blob);
        if (!liveListenerEnabled || !transcript) return;
        appendTranscriptForDetection(transcript);
      })
      .catch((err) => {
        if (!liveListenerEnabled) return;
        setLiveStatus(`Live transcription error: ${err.message || err}`, '#dc2626');
      });
  }

  async function resolveLiveQuestion(question, detectedAtMs) {
    if (isPracticeBlocked()) {
      renderPracticeAccessBanner();
      return;
    }
    if (liveInFlight) return;
    liveInFlight = true;

    const role = (roleInput?.value || '').trim();
    const scenario = (scenarioInput?.value || '').trim();
    const cleanQuestion = String(question || '').trim();
    if (!cleanQuestion) {
      liveInFlight = false;
      return;
    }

    liveQuestionInput.value = cleanQuestion;
    resultDiv.innerHTML = renderInstantAnswerMarkup(cleanQuestion, role);
    const instantLatency = Date.now() - detectedAtMs;
    setLiveStatus(`Detected question and posted instant response in ${instantLatency} ms.`, '#0f766e');

    try {
      const data = await postInterviewAssist({
        role,
        scenario,
        question: cleanQuestion,
        liveMode: true
      });

      if (data.answer) {
        resultDiv.innerHTML = renderFeedbackMarkup(data);
        incrementPracticeCount();
        if (window.RoleRocketQuickstart) {
          window.RoleRocketQuickstart.completeStep('interview', 'interview_live_listening');
        }
      } else {
        resultDiv.innerHTML = '<span style="color:#dc2626;">No customized answer returned. Try again.</span>';
      }
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
    } finally {
      liveInFlight = false;
    }
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
    if (isPracticeBlocked()) {
      renderPracticeAccessBanner();
      resultDiv.innerHTML = '<span style="color:#dc2626;">Your free practice question has been used. Upgrade to continue practicing.</span>';
      return;
    }
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
            answer,
            liveMode: true
          });

          feedbackDiv.innerHTML = feedbackData.answer
            ? renderFeedbackMarkup(feedbackData)
            : '<span style="color:#dc2626;">No feedback received.</span>';

          if (feedbackData.answer && window.RoleRocketQuickstart) {
            incrementPracticeCount();
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
    if (isPracticeBlocked()) {
      renderPracticeAccessBanner();
      resultDiv.innerHTML = '<span style="color:#dc2626;">Your free practice question has been used. Upgrade to continue practicing.</span>';
      return;
    }
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
              answer: transcript,
              liveMode: true
            });

            if (feedbackData.answer) {
              resultDiv.innerHTML += `<div style="margin-top:12px;">${renderFeedbackMarkup(feedbackData)}</div>`;
              window.AIInterviewAudio.speakText(feedbackData.answer);
              incrementPracticeCount();
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

  async function getLiveCopilotAnswer() {
    if (isPracticeBlocked()) {
      renderPracticeAccessBanner();
      resultDiv.innerHTML = '<span style="color:#dc2626;">Your free practice question has been used. Upgrade to continue practicing.</span>';
      return;
    }
    const role = (roleInput?.value || '').trim();
    const scenario = (scenarioInput?.value || '').trim();
    const question = (liveQuestionInput?.value || '').trim();

    if (!question) {
      resultDiv.innerHTML = '<span style="color:#dc2626;">Type the recruiter question first.</span>';
      return;
    }

    resultDiv.innerHTML = '<em>Generating live copilot answer...</em>';

    try {
      const data = await postInterviewAssist({
        role,
        scenario,
        question,
        liveMode: true
      });

      if (!data.answer) {
        resultDiv.innerHTML = '<span style="color:#dc2626;">No answer returned. Try again.</span>';
        return;
      }

      resultDiv.innerHTML = renderFeedbackMarkup(data);
      incrementPracticeCount();
      if (window.RoleRocketQuickstart) {
        window.RoleRocketQuickstart.completeStep('interview', 'interview_live_copilot');
      }
    } catch (err) {
      resultDiv.innerHTML = `<span style="color:#dc2626;">${escapeHtml(err.message || err)}</span>`;
    }
  }

  async function startLiveListening() {
    if (isPracticeBlocked()) {
      renderPracticeAccessBanner();
      return;
    }
    if (!window.AIInterviewAudio?.startSharedAudioCapture) {
      setLiveStatus('Live listening is not supported in this browser.', '#dc2626');
      return;
    }

    try {
      liveListenerEnabled = true;
      liveTranscriptionQueue = Promise.resolve();
      pendingTranscript = '';
      lastTranscriptChunk = '';
      setLiveButtons(true);
      setLiveStatus('Choose the interview tab or audio source and enable Share audio.', '#0f766e');

      await window.AIInterviewAudio.startSharedAudioCapture({
        onChunk(blob) {
          queueLiveTranscription(blob);
        },
        onError(event) {
          setLiveStatus(`Live listening error: ${event?.message || event?.error || 'unknown'}`, '#dc2626');
          stopLiveListening();
        },
        onState(state) {
          if (!liveListenerEnabled) return;
          if (state === 'requesting-permission') {
            setLiveStatus('Waiting for you to share the interview audio...', '#1d4ed8');
          } else if (state === 'fallback-mic') {
            setLiveStatus('Shared audio was unavailable. Switched to microphone listening.', '#b45309');
          } else if (state === 'listening') {
            setLiveStatus('Listening to shared interview audio...', '#0f766e');
          } else if (state === 'listening-mixed') {
            setLiveStatus('Listening to shared audio + microphone (recruiter and your voice).', '#0f766e');
          } else if (state === 'listening-mic') {
            setLiveStatus('Listening via microphone fallback. Keep speaker volume up so recruiter audio is captured.', '#0f766e');
          } else if (state === 'stopped') {
            stopLiveListening();
          }
        }
      });
    } catch (err) {
      liveListenerEnabled = false;
      setLiveButtons(false);
      setLiveStatus(`Could not start live listening: ${err.message || err}`, '#dc2626');
    }
  }

  function stopLiveListening() {
    liveListenerEnabled = false;
    if (liveDebounceTimer) clearTimeout(liveDebounceTimer);
    liveDebounceTimer = null;
    pendingTranscript = '';
    lastTranscriptChunk = '';
    if (window.AIInterviewAudio?.stopSharedAudioCapture) {
      window.AIInterviewAudio.stopSharedAudioCapture();
    }
    setLiveButtons(false);
    setLiveStatus('Live listener stopped.', '#475569');
  }

  startBtn?.addEventListener('click', startInterview);
  startAudioBtn?.addEventListener('click', startAudioPractice);
  liveAnswerBtn?.addEventListener('click', getLiveCopilotAnswer);
  startLiveCaptureBtn?.addEventListener('click', startLiveListening);
  stopLiveCaptureBtn?.addEventListener('click', stopLiveListening);

  loadPracticeAccess();
});
