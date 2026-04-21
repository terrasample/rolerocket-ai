document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const topic = String(params.get('topic') || '').trim();

  const titleMain = document.getElementById('courseTitleMain');
  const titleSide = document.getElementById('courseTitleSide');
  const subtitleSide = document.getElementById('courseSubtitleSide');
  const level = document.getElementById('courseLevel');
  const duration = document.getElementById('courseDuration');
  const demand = document.getElementById('courseDemand');
  const overview = document.getElementById('courseOverview');
  const outcomes = document.getElementById('courseOutcomeList');
  const resumeSignals = document.getElementById('courseResumeSignals');
  const modules = document.getElementById('courseModules');
  const capstone = document.getElementById('courseCapstone');
  const assessment = document.getElementById('courseAssessment');
  const interviewPrep = document.getElementById('courseInterviewPrep');
  const capstoneSection = document.getElementById('courseCapstoneSection');
  const assessmentSection = document.getElementById('courseAssessmentSection');
  const interviewPrepSection = document.getElementById('courseInterviewPrepSection');
  const progressSummary = document.getElementById('courseProgressSummary');
  const progressPercent = document.getElementById('courseProgressPercent');
  const progressBar = document.getElementById('courseProgressBar');
  const refreshCourseBtn = document.getElementById('refreshCourseBtn');
  const certificateBtn = document.getElementById('downloadCourseCertificateBtn');
  const audioVoiceSelect = document.getElementById('courseAudioVoiceSelect');

  const progressState = {
    totalModules: 0,
    completedModules: new Set(),
    learnerName: 'Learner',
    sessionToken: '',
    moduleNarration: [],
    answerKey: [],
    answerExplanations: [],
    assessmentCompleted: false,
    lastProgressFeedback: null,
    pendingAdvance: null
  };
  let moduleHandlersBound = false;
  const PROGRESS_CHECK_TIMEOUT_MS = 8000;

  const audioState = {
    activeModuleIndex: null,
    utterance: null,
    isPaused: false,
    rate: 0.96,
    voices: [],
    selectedVoice: ''
  };
  const AUDIO_VOICE_PREF_KEY = 'courseAudioVoicePreference';

  function apiPath(path) {
    return typeof apiUrl === 'function' ? apiUrl(path) : path;
  }

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function renderList(target, items) {
    if (!target) return;
    const list = asArray(items);
    if (!list.length) {
      target.innerHTML = '<li>No details available yet.</li>';
      return;
    }
    target.innerHTML = list.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(String(item))}</li>`).join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getBestVoice(voices) {
    if (!Array.isArray(voices) || !voices.length) return null;

    const noveltyPatterns = [
      /bad news/i,
      /bahh/i,
      /bells/i,
      /boing/i,
      /bubbles/i,
      /jester/i,
      /organ/i,
      /trinoids/i,
      /whisper/i,
      /wobble/i,
      /zarvox/i,
      /superstar/i,
      /junior/i
    ];

    const preferredNames = [
      /samantha/i,
      /karen/i,
      /moira/i,
      /daniel/i,
      /google us english/i,
      /microsoft.*aria/i,
      /microsoft.*jenny/i,
      /alloy/i,
      /nova/i
    ];

    const scored = voices.map((voice) => {
      const name = String(voice?.name || '');
      const lang = String(voice?.lang || '').toLowerCase();
      let score = 0;

      if (/^en[-_]/i.test(lang)) score += 15;
      if (voice?.localService) score += 3;
      if (preferredNames.some((pattern) => pattern.test(name))) score += 20;
      if (noveltyPatterns.some((pattern) => pattern.test(name))) score -= 30;

      return { voice, score };
    });

    scored.sort((left, right) => right.score - left.score);
    return scored[0]?.voice || voices[0] || null;
  }

  function populateVoiceOptions() {
    if (!audioVoiceSelect || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices()
      .filter((voice) => voice && voice.name)
      .sort((left, right) => String(left.name).localeCompare(String(right.name)));

    audioState.voices = voices;
    const rememberedVoice = String(localStorage.getItem(AUDIO_VOICE_PREF_KEY) || '').trim();
    const previousSelection = audioState.selectedVoice || audioVoiceSelect.value || rememberedVoice || '';
    const options = ['<option value="">System Default</option>']
      .concat(voices.map((voice) => `<option value="${String(voice.voiceURI || voice.name)}">${String(voice.name)}${voice.lang ? ` (${voice.lang})` : ''}</option>`));

    audioVoiceSelect.innerHTML = options.join('');
    const hasPrevious = voices.some((voice) => String(voice.voiceURI || voice.name) === previousSelection);
    const bestVoice = getBestVoice(voices);
    const defaultVoiceKey = String(bestVoice?.voiceURI || bestVoice?.name || '');
    audioVoiceSelect.value = hasPrevious ? previousSelection : defaultVoiceKey;
    audioState.selectedVoice = audioVoiceSelect.value;
  }

  function getSelectedVoice() {
    const voiceKey = String(audioState.selectedVoice || '').trim();
    if (!voiceKey) return null;
    return audioState.voices.find((voice) => String(voice.voiceURI || voice.name) === voiceKey) || null;
  }

  function updateProgressUi() {
    const total = Number(progressState.totalModules || 0);
    const completed = progressState.completedModules.size;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (progressSummary) {
      progressSummary.textContent = `Progress: ${completed} of ${total} modules completed`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${percent}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }

    if (certificateBtn) {
      certificateBtn.style.display = total > 0 && completed === total ? 'inline-block' : 'none';
    }
  }

  function updateProgressiveSections() {
    const hasModules = progressState.totalModules > 0;
    const allModulesComplete = hasModules && progressState.completedModules.size >= progressState.totalModules;
    const assessmentComplete = progressState.assessmentCompleted === true;

    if (capstoneSection) capstoneSection.hidden = !allModulesComplete;
    if (assessmentSection) assessmentSection.hidden = !allModulesComplete;
    if (interviewPrepSection) interviewPrepSection.hidden = !(allModulesComplete && assessmentComplete);
  }

  function getProgressCheckExplanation(idx) {
    const directExplanation = String(progressState.answerExplanations[idx] || '').trim();
    if (directExplanation) return directExplanation;
    const moduleItem = progressState.allModules?.[idx] || null;
    const objective = String(moduleItem?.objective || '').trim();
    if (objective) {
      return `This matches the objective of the module: ${objective}`;
    }
    return 'This answer best reflects the core lesson from the module.';
  }

  function formatProgressCheckFeedback(isCorrect, correctAnswer, explanation) {
    if (isCorrect) {
      return explanation || (correctAnswer ? `The correct answer is "${correctAnswer}".` : 'Well done.');
    }
    const answerLine = correctAnswer ? `The correct answer is "${correctAnswer}".` : '';
    return [answerLine, explanation].filter(Boolean).join(' ');
  }

  function setResultHtml(resultWrap, isCorrect, message) {
    const color = isCorrect ? '#86efac' : '#fda4af';
    const icon = isCorrect ? '✓' : '✗';
    const label = isCorrect ? 'Correct' : 'Not quite';
    resultWrap.innerHTML = `<span style="font-weight:700;color:${color};">${icon} ${escapeHtml(label)}.</span> <span style="color:#d0d9e7;">${escapeHtml(message)}</span>`;
  }

  function queueProgressAdvance(idx, completedModules, feedbackMessage) {
    const normalized = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

    progressState.pendingAdvance = {
      idx,
      completedModules: normalized,
      feedbackMessage: String(feedbackMessage || '').trim()
    };

    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${idx}"]`);
    const submitButton = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const continueButton = document.querySelector(`button[data-progress-continue-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    answerInputs.forEach((input) => {
      input.disabled = true;
    });

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Correct!';
      submitButton.style.opacity = '0.75';
      submitButton.style.cursor = 'default';
    }

    if (continueButton) {
      continueButton.style.display = 'inline-flex';
      continueButton.disabled = false;
      continueButton.style.opacity = '1';
      continueButton.style.cursor = 'pointer';

      const isSmallViewport = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 900px)').matches
        : (window.innerWidth <= 900);
      if (isSmallViewport) {
        window.requestAnimationFrame(() => {
          continueButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          continueButton.focus({ preventScroll: true });
        });
      }
    }

    if (resultWrap) {
      setResultHtml(resultWrap, true, feedbackMessage);
    }
  }

  function finalizeProgressAdvance(idx) {
    const pending = progressState.pendingAdvance;
    if (!pending || Number(pending.idx) !== Number(idx)) return;
    progressState.pendingAdvance = null;
    applyCompletedModules(pending.completedModules, Number(idx));
  }

  function resetModuleAudioButtons() {
    document.querySelectorAll('button[data-module-audio-play-btn]').forEach((button) => {
      button.textContent = 'Play Audio';
      button.style.opacity = '1';
    });
    document.querySelectorAll('button[data-module-audio-pause-btn]').forEach((button) => {
      button.textContent = 'Pause';
      button.disabled = true;
      button.style.opacity = '0.65';
      button.style.cursor = 'default';
    });
  }

  function setModuleAudioControls(idx, isPlaying) {
    const playButton = document.querySelector(`button[data-module-audio-play-btn="${idx}"]`);
    const pauseButton = document.querySelector(`button[data-module-audio-pause-btn="${idx}"]`);
    if (playButton) {
      playButton.textContent = isPlaying ? 'Stop Audio' : 'Play Audio';
    }
    if (pauseButton) {
      pauseButton.disabled = !isPlaying;
      pauseButton.style.opacity = isPlaying ? '1' : '0.65';
      pauseButton.style.cursor = isPlaying ? 'pointer' : 'default';
      pauseButton.textContent = audioState.isPaused ? 'Resume' : 'Pause';
    }
  }

  function stopModuleAudio() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    audioState.activeModuleIndex = null;
    audioState.utterance = null;
    audioState.isPaused = false;
    resetModuleAudioButtons();
  }

  function playModuleAudio(idx, restart = false) {
    if (!restart && audioState.activeModuleIndex === idx) {
      stopModuleAudio();
      return;
    }

    const narration = String(progressState.moduleNarration[idx] || '').trim();
    if (!narration) return;

    stopModuleAudio();

    const playButton = document.querySelector(`button[data-module-audio-play-btn="${idx}"]`);
    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.rate = audioState.rate;
    utterance.pitch = 1;
    utterance.voice = getSelectedVoice();
    utterance.onend = stopModuleAudio;
    utterance.onerror = stopModuleAudio;

    audioState.activeModuleIndex = idx;
    audioState.utterance = utterance;
    audioState.isPaused = false;
    if (playButton) playButton.textContent = 'Stop Audio';
    setModuleAudioControls(idx, true);
    window.speechSynthesis.speak(utterance);
  }

  function startModuleAudio(idx) {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      alert('Audio playback is not supported in this browser.');
      return;
    }

    playModuleAudio(idx, false);
  }

  function togglePauseModuleAudio(idx) {
    if (!window.speechSynthesis || audioState.activeModuleIndex !== idx || !audioState.utterance) {
      return;
    }

    if (window.speechSynthesis.paused || audioState.isPaused) {
      window.speechSynthesis.resume();
      audioState.isPaused = false;
    } else {
      window.speechSynthesis.pause();
      audioState.isPaused = true;
    }

    setModuleAudioControls(idx, true);
  }

  function updateAudioRate(nextRate) {
    const parsed = Number(nextRate);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    audioState.rate = parsed;

    if (audioState.activeModuleIndex !== null) {
      playModuleAudio(audioState.activeModuleIndex, true);
    }
  }

  function setPassedModuleUi(idx, source) {
    const moduleStatus = document.querySelector(`[data-module-status-indicator="${idx}"]`);
    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    if (moduleStatus) {
      moduleStatus.setAttribute('data-completed', 'true');
      moduleStatus.style.background = '#22c55e';
      moduleStatus.style.borderColor = '#22c55e';
      moduleStatus.innerHTML = '<span style="display:block;width:6px;height:10px;border:solid #052e16;border-width:0 2px 2px 0;transform:rotate(45deg);"></span>';
    }
    answerInputs.forEach((input) => {
      input.disabled = true;
    });
    if (button) {
      button.disabled = true;
      button.textContent = 'Passed';
      button.style.opacity = '0.75';
      button.style.cursor = 'default';
    }
    if (resultWrap) {
      resultWrap.textContent = source === 'restored'
        ? 'Passed previously. Module remains completed.'
        : 'Correct. Module marked as completed.';
      resultWrap.style.color = '#86efac';
    }
  }

  function applyCompletedModules(completedModules, freshIdx) {
    const normalized = asArray(completedModules)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

    progressState.pendingAdvance = null;
    progressState.completedModules = new Set(normalized);
    normalized.forEach((completedIdx) => setPassedModuleUi(completedIdx, completedIdx === freshIdx ? 'fresh' : 'restored'));
    updateProgressUi();
    renderProgressiveContent();
    updateProgressiveSections();
    
    const isAllComplete = progressState.completedModules.size >= progressState.totalModules;
    if (isAllComplete && assessment) {
      renderAssessment(progressState.assessmentItems || []);
    }
  }

  function resolveLocalCorrectOptionIndex(idx) {
    const candidate = Number(progressState.answerKey[idx]);
    return Number.isInteger(candidate) && candidate >= 0 ? candidate : null;
  }

  function applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap) {
    const correctOptionIndex = resolveLocalCorrectOptionIndex(idx);
    if (!Number.isInteger(correctOptionIndex)) {
      resultWrap.textContent = 'Answer validation is unavailable right now. Refresh the course and try again.';
      resultWrap.style.color = '#fbbf24';
      return false;
    }

    const correctAnswer = String(progressState.allModules?.[idx]?.progressCheckOptions?.[correctOptionIndex] || '').trim();
    const explanation = getProgressCheckExplanation(idx);

    if (selectedOptionIndex !== correctOptionIndex) {
      progressState.lastProgressFeedback = null;
      setResultHtml(resultWrap, false, formatProgressCheckFeedback(false, correctAnswer, explanation));
      return false;
    }

    const completedModules = Array.from(new Set([
      ...progressState.completedModules,
      idx
    ])).sort((left, right) => left - right);

    progressState.lastProgressFeedback = null;
    queueProgressAdvance(idx, completedModules, formatProgressCheckFeedback(true, correctAnswer, explanation));
    return true;
  }

  function setCourseLoadingState(isLoading, buttonLabel) {
    if (!refreshCourseBtn) return;
    refreshCourseBtn.disabled = isLoading;
    refreshCourseBtn.textContent = isLoading ? (buttonLabel || 'Refreshing...') : 'Refresh Course';
    refreshCourseBtn.style.opacity = isLoading ? '0.75' : '1';
    refreshCourseBtn.style.cursor = isLoading ? 'default' : 'pointer';
  }

  async function runProgressCheck(idx) {
    if (progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === Number(idx)) {
      return;
    }

    if (progressState.completedModules.has(idx)) {
      setPassedModuleUi(idx, 'restored');
      return;
    }

    const token = getToken();
    const selectedOption = document.querySelector(`input[name="module-progress-check-${idx}"]:checked`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    if (!resultWrap || !button) return;

    if (!selectedOption) {
      resultWrap.textContent = 'Select an answer first.';
      resultWrap.style.color = '#fda4af';
      return;
    }

    const selectedOptionIndex = Number(selectedOption.value);
    const fallbackCorrectAnswer = String(progressState.allModules?.[idx]?.progressCheckOptions?.[Number(progressState.answerKey[idx])] || '').trim();
    const fallbackExplanation = getProgressCheckExplanation(idx);

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Checking...';
    let timeoutId = null;

    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      timeoutId = controller
        ? window.setTimeout(() => controller.abort(), PROGRESS_CHECK_TIMEOUT_MS)
        : null;
      const response = await fetch(apiPath('/api/learning/course-progress-check'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: controller?.signal,
        body: JSON.stringify({
          topic,
          moduleIndex: idx,
          selectedOptionIndex,
          sessionToken: progressState.sessionToken
        })
      });
      if (timeoutId) window.clearTimeout(timeoutId);

      const payload = await response.json();
      if (response.ok && payload?.passed) {
        const feedbackMsg = formatProgressCheckFeedback(
          true,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        progressState.lastProgressFeedback = null;
        queueProgressAdvance(idx, payload?.completedModules, feedbackMsg);
        return;
      }

      if (response.status === 409) {
        resultWrap.textContent = String(payload?.error || 'Session expired. Reload the course.');
        resultWrap.style.color = '#fbbf24';
      } else if (response.status === 400 && payload?.error) {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = String(payload.error);
        resultWrap.style.color = '#fda4af';
      } else {
        progressState.lastProgressFeedback = null;
        const wrongMsg = formatProgressCheckFeedback(
          false,
          String(payload?.correctOptionText || fallbackCorrectAnswer).trim(),
          String(payload?.explanation || fallbackExplanation).trim()
        );
        setResultHtml(resultWrap, false, wrongMsg);
      }
    } catch (error) {
      const usedLocalFallback = applyLocalProgressCheck(idx, selectedOptionIndex, resultWrap);
      if (usedLocalFallback) {
        setResultHtml(resultWrap, true, formatProgressCheckFeedback(true, fallbackCorrectAnswer, fallbackExplanation));
      } else if (error?.name === 'AbortError') {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = 'Validation took too long. Refresh the course and try again.';
        resultWrap.style.color = '#fbbf24';
      } else {
        progressState.lastProgressFeedback = null;
        resultWrap.textContent = 'Check failed. Please try again.';
        resultWrap.style.color = '#fda4af';
      }
    } finally {
      const isPending = progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === Number(idx);
      if (!progressState.completedModules.has(idx) && !isPending) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function loadProgress() {
    const token = getToken();
    if (!token || !topic || progressState.totalModules <= 0) {
      updateProgressUi();
      return;
    }

    try {
      const response = await fetch(apiPath(`/api/learning/course-progress?topic=${encodeURIComponent(topic)}`), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        updateProgressUi();
        return;
      }

      const payload = await response.json();
      const completed = asArray(payload?.completedModules)
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

      progressState.completedModules = new Set(completed);

      document.querySelectorAll('[data-module-status-indicator]').forEach((indicator) => {
        const idx = Number(indicator.getAttribute('data-module-status-indicator'));
        const isCompleted = progressState.completedModules.has(idx);
        indicator.setAttribute('data-completed', isCompleted ? 'true' : 'false');
        indicator.style.background = isCompleted ? '#22c55e' : 'rgba(148, 163, 184, 0.15)';
        indicator.style.borderColor = isCompleted ? '#22c55e' : 'rgba(148, 163, 184, 0.35)';
        indicator.innerHTML = isCompleted
          ? '<span style="display:block;width:6px;height:10px;border:solid #052e16;border-width:0 2px 2px 0;transform:rotate(45deg);"></span>'
          : '';
      });

      completed.forEach((idx) => setPassedModuleUi(idx, 'restored'));

      updateProgressUi();
      renderProgressiveContent();
      updateProgressiveSections();
      if (progressState.completedModules.size >= progressState.totalModules) {
        renderAssessment(progressState.assessmentItems || []);
      }
    } catch (error) {
      updateProgressUi();
    }
  }

  function bindProgressHandlers() {
    if (moduleHandlersBound || !modules) return;
    moduleHandlersBound = true;

    modules.addEventListener('click', async function (event) {
      const continueButton = event.target.closest('button[data-progress-continue-btn]');
      if (continueButton) {
        const idx = Number(continueButton.getAttribute('data-progress-continue-btn'));
        finalizeProgressAdvance(idx);
        return;
      }

      const progressButton = event.target.closest('button[data-progress-check-btn]');
      if (progressButton) {
        const idx = Number(progressButton.getAttribute('data-progress-check-btn'));
        await runProgressCheck(idx);
        return;
      }

      const playButton = event.target.closest('button[data-module-audio-play-btn]');
      if (playButton) {
        const idx = Number(playButton.getAttribute('data-module-audio-play-btn'));
        startModuleAudio(idx);
        return;
      }

      const pauseButton = event.target.closest('button[data-module-audio-pause-btn]');
      if (pauseButton) {
        const idx = Number(pauseButton.getAttribute('data-module-audio-pause-btn'));
        togglePauseModuleAudio(idx);
      }
    });

    modules.addEventListener('change', function (event) {
      const rateSelect = event.target.closest('select[data-module-audio-rate]');
      if (!rateSelect) return;
      updateAudioRate(rateSelect.value);
    });

    if (audioVoiceSelect) {
      audioVoiceSelect.addEventListener('change', function () {
        audioState.selectedVoice = audioVoiceSelect.value;
        try {
          localStorage.setItem(AUDIO_VOICE_PREF_KEY, audioState.selectedVoice || '');
        } catch (error) {
          // Ignore storage failures in restricted browser contexts.
        }
        if (audioState.activeModuleIndex !== null) {
          playModuleAudio(audioState.activeModuleIndex, true);
        }
      });
    }

    if (assessment) {
      assessment.addEventListener('click', async function (event) {
        const submitBtn = event.target.closest('#submitAssessmentBtn');
        if (!submitBtn) return;

        const answers = new Array(progressState.assessmentItems.length).fill('');
        document.querySelectorAll('[data-assessment-answer]').forEach((textarea) => {
          const idx = Number(textarea.getAttribute('data-assessment-answer'));
          answers[idx] = String(textarea.value || '').trim();
        });

        const allAnswered = answers.every(a => a.length > 0);
        const resultDiv = document.getElementById('assessmentResult');
        if (!resultDiv) return;

        if (!allAnswered) {
          resultDiv.innerHTML = '<span style="color:#fda4af;">Please answer all questions before submitting.</span>';
          return;
        }

        progressState.assessmentAnswers = answers;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        resultDiv.innerHTML = '<span style="color:#93c5fd;">Processing assessment...</span>';

        setTimeout(() => {
          progressState.assessmentCompleted = true;
          resultDiv.innerHTML = `
            <div style="color:#86efac;line-height:1.8;">
              <strong>✓ Assessment Complete!</strong>
              <p style="margin:8px 0 0;">You have successfully completed all course materials. Scroll down to view your interview preparation resources.</p>
            </div>
          `;
          submitBtn.style.display = 'none';
          updateProgressiveSections();
          renderInterviewPrep(progressState.interviewPrepItems);
        }, 1200);
      });
    }
  }

  function renderInterviewPrep(items) {
    if (!interviewPrep) return;

    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;
    const isAssessmentComplete = progressState.assessmentAnswers && progressState.assessmentAnswers.every(a => a && String(a).trim());

    if (!isAllModuleComplete) {
      interviewPrep.innerHTML = '<li style="color:#9fb0c7;">Complete the course and final assessment to unlock interview prep.</li>';
      return;
    }

    if (!isAssessmentComplete) {
      interviewPrep.innerHTML = '<li style="color:#9fb0c7;">Submit the final assessment to unlock interview prep.</li>';
      return;
    }

    const list = asArray(items);
    if (!list.length) {
      interviewPrep.innerHTML = '<li>No interview prep available.</li>';
      return;
    }

    interviewPrep.innerHTML = list.map((item) => `<li style="margin-bottom:12px;color:#d0d9e7;line-height:1.6;">${escapeHtml(String(item))}</li>`).join('');
  }

  function getModuleReasoningFromAssessment(moduleIdx) {
    if (!progressState.assessmentItems || !progressState.assessmentItems[moduleIdx]) return '';
    const assessmentItem = progressState.assessmentItems[moduleIdx];
    return String(assessmentItem?.answer || '').slice(0, 200);
  }

  function renderModules(modulesData) {
    const list = asArray(modulesData);
    if (!modules) return;

    progressState.totalModules = list.length;
    progressState.completedModules = new Set();
    progressState.answerKey = list.map((moduleItem) => Number(moduleItem?.correctOptionIndex));
    progressState.answerExplanations = list.map((moduleItem, index) => String(moduleItem?.progressCheckExplanation || getModuleReasoningFromAssessment(index) || '').trim());
    progressState.assessmentCompleted = false;
    progressState.lastProgressFeedback = null;
    progressState.moduleNarration = list.map((moduleItem, index) => {
      const options = asArray(moduleItem?.progressCheckOptions)
        .map((option, optionIndex) => `Option ${optionIndex + 1}. ${String(option)}`)
        .join(' ');
      return [
        `Module ${index + 1}. ${String(moduleItem?.title || `Module ${index + 1}`)}.`,
        `Objective. ${String(moduleItem?.objective || '')}`,
        `Lesson. ${String(moduleItem?.lesson || '')}`,
        `Worked example. ${String(moduleItem?.workedExample || '')}`,
        `Common mistake. ${String(moduleItem?.commonMistake || '')}`,
        `Practice task. ${String(moduleItem?.practiceTask || '')}`,
        `Progress check. ${String(moduleItem?.progressCheckQuestion || '')}`,
        options
      ].filter(Boolean).join(' ');
    });
    progressState.allModules = list;
    updateProgressUi();
    renderProgressiveContent();
    updateProgressiveSections();
  }

  function renderProgressiveContent() {
    if (!modules || !progressState.allModules) return;
    const list = progressState.allModules;
    if (!list.length) {
      modules.innerHTML = '<div class="module-item"><p>Modules are not available right now.</p></div>';
      return;
    }

    const completed = progressState.completedModules.size;
    const currentIdx = Math.min(completed, list.length - 1);
    const currentModule = list[currentIdx];
    const isAllComplete = completed >= list.length;

    let html = '';

    if (progressState.lastProgressFeedback?.message) {
      const isSuccess = progressState.lastProgressFeedback.type === 'success';
      const fbIcon = isSuccess ? '✓' : '✗';
      const fbLabel = isSuccess ? 'Correct' : 'Not quite';
      const fbMsg = escapeHtml(progressState.lastProgressFeedback.message);
      html += `<div style="margin-bottom:16px;padding:14px;border-radius:10px;border:1px solid ${isSuccess ? '#10b981' : '#f59e0b'};background:${isSuccess ? '#052e25' : '#3b1d12'};line-height:1.6;"><span style="font-weight:700;color:${isSuccess ? '#86efac' : '#fda4af'}">${fbIcon} ${fbLabel}.</span> <span style="color:${isSuccess ? '#a7f3d0' : '#fde68a'}">${fbMsg}</span></div>`;
    }

    if (completed > 0) {
      html += `<div style="margin-bottom:20px;padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;">
        <strong style="font-size:0.9rem;">Progress:</strong> ${completed} of ${list.length} modules completed ✓
      </div>`;
    }

    if (isAllComplete) {
      html += `<div style="margin-bottom:20px;padding:16px;border-radius:10px;background:#065f46;border:1px solid #10b981;color:#a7f3d0;text-align:center;font-weight:700;font-size:1rem;">
        🎉 All modules complete! Your capstone project and final assessment are now unlocked below.
      </div>`;
    } else {
      const index = currentIdx;
      const moduleItem = currentModule;
      const title = escapeHtml(String(moduleItem?.title || `Module ${index + 1}`));
      const objective = escapeHtml(String(moduleItem?.objective || ''));
      const lesson = escapeHtml(String(moduleItem?.lesson || ''));
      const workedExample = escapeHtml(String(moduleItem?.workedExample || ''));
      const commonMistake = escapeHtml(String(moduleItem?.commonMistake || ''));
      const practiceTask = escapeHtml(String(moduleItem?.practiceTask || ''));
      const progressCheckQuestion = escapeHtml(String(moduleItem?.progressCheckQuestion || `In one sentence, what is the key takeaway of module ${index + 1}?`));
      const progressCheckOptions = asArray(moduleItem?.progressCheckOptions).slice(0, 4);
      const pendingAdvance = progressState.pendingAdvance && Number(progressState.pendingAdvance.idx) === index
        ? progressState.pendingAdvance
        : null;
      const optionMarkup = progressCheckOptions.map((option, optionIndex) => `
        <label style="display:grid;grid-template-columns:18px minmax(0,1fr);align-items:flex-start;column-gap:10px;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;overflow:hidden;">
          <input type="radio" name="module-progress-check-${index}" data-progress-check-option="${index}" value="${optionIndex}" ${pendingAdvance ? 'disabled' : ''} style="margin-top:3px;accent-color:#2563eb;" />
          <span style="line-height:1.5;word-break:break-word;overflow-wrap:anywhere;white-space:normal;min-width:0;max-width:100%;flex:1 1 auto;display:block;">${escapeHtml(String(option))}</span>
        </label>
      `).join('');
      const pendingResultMarkup = pendingAdvance
        ? `<span style="font-weight:700;color:#86efac;">✓ Correct.</span> <span style="color:#d0d9e7;">${escapeHtml(String(pendingAdvance.feedbackMessage || ''))}</span>`
        : '';

      html += `
        <section class="module-item">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;margin-bottom:8px;">
            <h4 style="margin:0;min-width:0;">Module ${index + 1} of ${list.length}: ${title}</h4>
            <div style="display:inline-flex;align-items:center;gap:8px;justify-self:end;max-width:100%;color:#93c5fd;font-size:0.82rem;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);">
              <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:0 0 14px;border-radius:50%;background:#60a5fa;color:#fff;font-size:0.7rem;font-weight:700;">↓</span>
              <span style="white-space:normal;word-break:break-word;line-height:1.2;">Current</span>
            </div>
          </div>
          <p><strong style="color:#93c5fd;">Objective:</strong> ${objective}</p>
          <p><strong style="color:#93c5fd;">Lesson:</strong> ${lesson}</p>
          <p><strong style="color:#93c5fd;">Worked Example:</strong> ${workedExample}</p>
          <p><strong style="color:#fda4af;">Common Mistake:</strong> ${commonMistake}</p>
          <p><strong style="color:#86efac;">Practice Task:</strong> ${practiceTask}</p>
          <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px 0;">
            <button type="button" data-module-audio-play-btn="${index}" style="background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:0.82rem;font-weight:700;">Play Audio</button>
            <button type="button" data-module-audio-pause-btn="${index}" disabled style="background:#1e293b;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px 12px;cursor:default;font-size:0.82rem;font-weight:700;opacity:0.65;">Pause</button>
            <label style="display:inline-flex;align-items:center;gap:6px;color:#cbd5e1;font-size:0.8rem;">
              Speed
              <select data-module-audio-rate="${index}" style="background:#0b1220;border:1px solid #2a3954;color:#f1f5f9;border-radius:8px;padding:7px 10px;">
                <option value="0.9">0.9x</option>
                <option value="1" selected>1.0x</option>
                <option value="1.15">1.15x</option>
                <option value="1.3">1.3x</option>
              </select>
            </label>
          </div>
          <div style="margin-top:12px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
            <div style="font-size:0.82rem;color:#c4b5fd;font-weight:700;margin-bottom:6px;">Progress Check</div>
            <div style="color:#d0d9e7;font-size:0.9rem;line-height:1.55;margin-bottom:8px;">${progressCheckQuestion}</div>
            <div style="display:grid;gap:8px;margin-bottom:10px;">${optionMarkup}</div>
            <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;">
              <button type="button" data-progress-check-btn="${index}" ${pendingAdvance ? 'disabled' : ''} style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:7px 10px;${pendingAdvance ? 'opacity:0.75;cursor:default;' : 'cursor:pointer;'}font-size:0.82rem;font-weight:700;">${pendingAdvance ? 'Correct!' : 'Submit Answer'}</button>
              <button type="button" data-progress-continue-btn="${index}" style="display:${pendingAdvance ? 'inline-flex' : 'none'};background:#0f766e;border:1px solid #14b8a6;color:#ecfeff;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.82rem;font-weight:700;">Continue to Next Module</button>
              <div data-progress-check-result="${index}" style="font-size:0.82rem;color:#9fb0c7;line-height:1.5;word-break:break-word;overflow-wrap:anywhere;width:100%;">${pendingResultMarkup}</div>
            </div>
          </div>
        </section>
      `;
    }

    modules.innerHTML = html;
  }

  function renderAssessment(rows) {
    const items = asArray(rows);
    if (!assessment) return;

    const isAllModuleComplete = progressState.totalModules > 0 && progressState.completedModules.size >= progressState.totalModules;

    if (!isAllModuleComplete) {
      assessment.innerHTML = '<div class="module-item"><p style="color:#9fb0c7;">Complete all course modules first. The final assessment will unlock when you finish Module ' + progressState.totalModules + '.</p></div>';
      return;
    }

    if (!items.length) {
      assessment.innerHTML = '<div class="module-item"><p>Assessment questions are not available yet.</p></div>';
      return;
    }

    progressState.assessmentItems = items;
    if (!progressState.assessmentCompleted) {
      progressState.assessmentAnswers = new Array(items.length).fill(null);
    }

    assessment.innerHTML = `
      <div style="padding:14px;border-radius:10px;background:#0d2438;border:1px solid #0ea5e9;color:#7dd3fc;margin-bottom:16px;font-size:0.9rem;">
        <strong>Final Assessment:</strong> Answer all questions to complete the course and unlock interview prep.
      </div>
      ${items.map((item, i) => {
        const question = String(item?.question || '');
        return `
          <div class="module-item" style="margin-bottom:12px;">
            <p style="margin-bottom:8px;"><strong style="color:#c4b5fd;">Question ${i + 1}:</strong> ${escapeHtml(question)}</p>
            <textarea 
              data-assessment-answer="${i}"
              placeholder="Type your answer here..."
              style="width:100%;min-height:80px;padding:10px;background:#111c31;border:1px solid #2a3954;border-radius:8px;color:#d0d9e7;font-family:inherit;font-size:0.9rem;resize:vertical;"
            ></textarea>
          </div>
        `;
      }).join('')}
      <button type="button" id="submitAssessmentBtn" style="background:#10b981;border:none;color:#fff;border-radius:6px;padding:10px 16px;cursor:pointer;font-size:0.9rem;font-weight:700;margin-top:16px;">Submit Assessment</button>
      <div id="assessmentResult" style="margin-top:12px;font-size:0.9rem;color:#9fb0c7;line-height:1.6;"></div>
    `;
  }

  function renderCourse(course) {
    const courseTitle = String(course?.courseTitle || topic || 'Course');
    titleMain.textContent = courseTitle;
    titleSide.textContent = courseTitle;
    subtitleSide.textContent = String(course?.subtitle || 'Complete professional course');
    level.textContent = String(course?.difficulty || 'Intermediate');
    duration.textContent = String(course?.estimatedDuration || '4-6 weeks');
    demand.textContent = String(course?.marketDemand || 'High demand in current job market.');
    overview.textContent = String(course?.overview || 'Overview not available.');

    renderList(outcomes, course?.learningOutcomes);
    renderList(resumeSignals, course?.resumeSignals);
    
    progressState.assessmentItems = asArray(course?.finalAssessment);
    progressState.interviewPrepItems = asArray(course?.interviewPrep);
    
    renderModules(course?.modules);

    const project = course?.capstoneProject || {};
    const deliverables = asArray(project?.deliverables)
      .map((item) => `<li style="margin-bottom:6px;">${String(item)}</li>`)
      .join('');
    capstone.innerHTML = `
      <p><strong style="color:#93c5fd;">Project:</strong> ${String(project?.title || `${courseTitle} Capstone`)}</p>
      <p><strong style="color:#93c5fd;">Scenario:</strong> ${String(project?.scenario || 'Build and deliver an end-to-end practical project.')}</p>
      <p style="margin-bottom:6px;"><strong style="color:#93c5fd;">Deliverables:</strong></p>
      <ul style="margin:0;padding-left:18px;">${deliverables || '<li>Project plan</li><li>Execution artifact</li><li>Results summary</li>'}</ul>
    `;

    renderAssessment(progressState.assessmentItems);
    renderInterviewPrep(progressState.interviewPrepItems);
    updateProgressiveSections();
  }

  async function loadLearnerIdentity() {
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(apiPath('/api/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();
      const name = String(payload?.user?.name || '').trim();
      if (name) progressState.learnerName = name;
    } catch (error) {
      // Use default learner name.
    }
  }

  function downloadCertificate() {
    if (!certificateBtn) return;
    const total = Number(progressState.totalModules || 0);
    const completed = progressState.completedModules.size;
    if (!total || completed !== total) return;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Certificate generation is unavailable right now.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    doc.setFillColor(247, 250, 252);
    doc.rect(24, 24, width - 48, height - 48, 'F');
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(2);
    doc.rect(24, 24, width - 48, height - 48);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(15, 23, 42);
    doc.text('Certificate of Completion', width / 2, 120, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text('This certifies that', width / 2, 168, { align: 'center' });

    doc.setFont('times', 'bold');
    doc.setFontSize(30);
    doc.setTextColor(30, 64, 175);
    doc.text(progressState.learnerName || 'Learner', width / 2, 220, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.setTextColor(51, 65, 85);
    doc.text('has successfully completed the course', width / 2, 260, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(15, 23, 42);
    doc.text(String(topic || 'Professional Course'), width / 2, 302, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(71, 85, 105);
    doc.text(`Completed modules: ${completed}/${total}`, width / 2, 338, { align: 'center' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, width / 2, 360, { align: 'center' });
    doc.text('Issued by RoleRocket AI Learning', width / 2, 402, { align: 'center' });

    const filename = `${String(topic || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-certificate.pdf`;
    doc.save(filename);
  }

  function renderAccessMessage(message, subtitle) {
    titleMain.textContent = topic || 'Course';
    titleSide.textContent = topic || 'Course';
    subtitleSide.textContent = subtitle || 'Course access required';
    overview.textContent = message;
    if (modules) {
      modules.innerHTML = '<div class="module-item"><p>Sign in with an Elite account to load modules, audio playback, and progress checks.</p></div>';
    }
    if (capstone) capstone.innerHTML = '<p>Capstone details will appear after course access is confirmed.</p>';
    if (assessment) assessment.innerHTML = '<div class="module-item"><p>Assessment questions will appear after course access is confirmed.</p></div>';
    if (interviewPrep) interviewPrep.innerHTML = '<li>Interview prep unlocks after course access is confirmed.</li>';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
  }

  async function loadCourse(forceRefresh = false) {
    if (!topic) {
      titleMain.textContent = 'No course selected';
      titleSide.textContent = 'No course selected';
      overview.textContent = 'Return to the course catalog and choose a course card.';
      return;
    }

    setCourseLoadingState(true, forceRefresh ? 'Refreshing...' : 'Loading...');
    stopModuleAudio();
    progressState.sessionToken = '';
    progressState.moduleNarration = [];
    progressState.pendingAdvance = null;
    titleMain.textContent = `Loading ${topic}...`;
    titleSide.textContent = `Loading ${topic}...`;
    subtitleSide.textContent = forceRefresh ? 'Refreshing course version...' : 'Generating complete curriculum...';
    overview.textContent = forceRefresh ? 'Please wait while we create a fresh version of this course.' : 'Please wait while we build your full course.';
    if (modules) modules.innerHTML = '';
    if (assessment) assessment.innerHTML = '';
    if (capstone) capstone.innerHTML = '';
    if (interviewPrep) interviewPrep.innerHTML = '';
    if (capstoneSection) capstoneSection.hidden = true;
    if (assessmentSection) assessmentSection.hidden = true;
    if (interviewPrepSection) interviewPrepSection.hidden = true;
    if (outcomes) outcomes.innerHTML = '';
    if (resumeSignals) resumeSignals.innerHTML = '';

    try {
      const response = await fetch(apiPath('/api/learning/course-content'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ topic, forceRefresh })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.course) {
        throw new Error((payload && payload.error) || 'Unable to load course.');
      }

      progressState.sessionToken = String(payload?.sessionToken || '').trim();
      renderCourse(payload.course);
      bindProgressHandlers();
      await loadProgress();
    } catch (error) {
      const message = String(error?.message || 'Unable to load course. Please try again.');
      if (/token|unauthorized|403|401/i.test(message)) {
        renderAccessMessage('Sign in and upgrade to Elite to open the full course experience for this topic.', 'Sign in required');
      } else {
        titleMain.textContent = topic;
        titleSide.textContent = topic;
        subtitleSide.textContent = 'Course generation failed';
        overview.textContent = message;
      }
    } finally {
      setCourseLoadingState(false);
    }
  }

  if (window.speechSynthesis) {
    populateVoiceOptions();
    window.speechSynthesis.onvoiceschanged = populateVoiceOptions;
  }

  certificateBtn?.addEventListener('click', downloadCertificate);
  refreshCourseBtn?.addEventListener('click', function () {
    const proceed = window.confirm('Refreshing will generate a new version of this course and reset progress if the content changes. Continue?');
    if (!proceed) return;
    loadCourse(true);
  });
  loadLearnerIdentity();
  loadCourse();
});
