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
  const progressSummary = document.getElementById('courseProgressSummary');
  const progressPercent = document.getElementById('courseProgressPercent');
  const progressBar = document.getElementById('courseProgressBar');
  const refreshCourseBtn = document.getElementById('refreshCourseBtn');
  const certificateBtn = document.getElementById('downloadCourseCertificateBtn');

  const progressState = {
    totalModules: 0,
    completedModules: new Set(),
    learnerName: 'Learner',
    sessionToken: '',
    moduleNarration: []
  };

  const audioState = {
    activeModuleIndex: null,
    utterance: null,
    isPaused: false,
    rate: 1
  };

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
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
    const moduleCheckbox = document.querySelector(`input[data-module-checkbox="${idx}"]`);
    const answerInputs = document.querySelectorAll(`input[data-progress-check-option="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    if (moduleCheckbox) {
      moduleCheckbox.checked = true;
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

  function setCourseLoadingState(isLoading, buttonLabel) {
    if (!refreshCourseBtn) return;
    refreshCourseBtn.disabled = isLoading;
    refreshCourseBtn.textContent = isLoading ? (buttonLabel || 'Refreshing...') : 'Refresh Course';
    refreshCourseBtn.style.opacity = isLoading ? '0.75' : '1';
    refreshCourseBtn.style.cursor = isLoading ? 'default' : 'pointer';
  }

  async function runProgressCheck(idx) {
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

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Checking...';

    try {
      const response = await fetch('/api/learning/course-progress-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic,
          moduleIndex: idx,
          selectedOptionIndex,
          sessionToken: progressState.sessionToken
        })
      });

      const payload = await response.json();
      if (response.ok && payload?.passed) {
        const completedModules = asArray(payload?.completedModules)
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < progressState.totalModules);

        progressState.completedModules = new Set(completedModules);
        completedModules.forEach((completedIdx) => setPassedModuleUi(completedIdx, completedIdx === idx ? 'fresh' : 'restored'));
        updateProgressUi();
        return;
      }

      if (response.status === 409) {
        resultWrap.textContent = String(payload?.error || 'Session expired. Reload the course.');
        resultWrap.style.color = '#fbbf24';
      } else if (response.status === 400 && payload?.error) {
        resultWrap.textContent = String(payload.error);
        resultWrap.style.color = '#fda4af';
      } else {
        resultWrap.textContent = 'Not quite. Review the module and try again.';
        resultWrap.style.color = '#fda4af';
      }
    } catch (error) {
      resultWrap.textContent = 'Check failed. Please try again.';
      resultWrap.style.color = '#fda4af';
    } finally {
      if (!progressState.completedModules.has(idx)) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  }

  async function loadProgress() {
    const token = getToken();
    if (!token || !topic || progressState.totalModules <= 0) {
      updateProgressUi();
      return;
    }

    try {
      const response = await fetch(`/api/learning/course-progress?topic=${encodeURIComponent(topic)}`, {
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

      document.querySelectorAll('input[data-module-checkbox]').forEach((checkbox) => {
        const idx = Number(checkbox.getAttribute('data-module-checkbox'));
        checkbox.checked = progressState.completedModules.has(idx);
      });

      completed.forEach((idx) => setPassedModuleUi(idx, 'restored'));

      updateProgressUi();
    } catch (error) {
      updateProgressUi();
    }
  }

  function bindProgressHandlers() {
    document.querySelectorAll('button[data-progress-check-btn]').forEach((button) => {
      button.addEventListener('click', async function () {
        const idx = Number(button.getAttribute('data-progress-check-btn'));
        await runProgressCheck(idx);
      });
    });

    document.querySelectorAll('button[data-module-audio-play-btn]').forEach((button) => {
      button.addEventListener('click', function () {
        const idx = Number(button.getAttribute('data-module-audio-play-btn'));
        startModuleAudio(idx);
      });
    });

    document.querySelectorAll('button[data-module-audio-pause-btn]').forEach((button) => {
      button.addEventListener('click', function () {
        const idx = Number(button.getAttribute('data-module-audio-pause-btn'));
        togglePauseModuleAudio(idx);
      });
    });

    document.querySelectorAll('select[data-module-audio-rate]').forEach((select) => {
      select.addEventListener('change', function () {
        updateAudioRate(select.value);
      });
    });
  }

  function renderList(target, items) {
    if (!target) return;
    const list = asArray(items);
    target.innerHTML = list.length
      ? list.map((item) => `<li style="margin-bottom:7px;">${String(item)}</li>`).join('')
      : '<li style="margin-bottom:7px;">No items provided.</li>';
  }

  function renderModules(modulesData) {
    const list = asArray(modulesData);
    if (!modules) return;

    progressState.totalModules = list.length;
    progressState.completedModules = new Set();
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
    updateProgressUi();

    if (!list.length) {
      modules.innerHTML = '<div class="module-item"><p>Modules are not available right now.</p></div>';
      return;
    }

    modules.innerHTML = list.map((moduleItem, index) => {
      const title = String(moduleItem?.title || `Module ${index + 1}`);
      const objective = String(moduleItem?.objective || '');
      const lesson = String(moduleItem?.lesson || '');
      const workedExample = String(moduleItem?.workedExample || '');
      const commonMistake = String(moduleItem?.commonMistake || '');
      const practiceTask = String(moduleItem?.practiceTask || '');
      const progressCheckQuestion = String(moduleItem?.progressCheckQuestion || `In one sentence, what is the key takeaway of module ${index + 1}?`);
      const progressCheckOptions = asArray(moduleItem?.progressCheckOptions).slice(0, 4);
      const optionMarkup = progressCheckOptions.map((option, optionIndex) => `
        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:8px;background:#111c31;border:1px solid #2a3954;cursor:pointer;color:#d0d9e7;">
          <input type="radio" name="module-progress-check-${index}" data-progress-check-option="${index}" value="${optionIndex}" style="margin-top:3px;accent-color:#2563eb;" />
          <span style="line-height:1.5;">${String(option)}</span>
        </label>
      `).join('');

      return `
        <section class="module-item">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
            <h4 style="margin:0;flex:1 1 260px;">Module ${index + 1}: ${title}</h4>
            <label style="display:inline-flex;align-items:center;gap:8px;color:#86efac;font-size:0.84rem;white-space:nowrap;flex-shrink:0;margin-left:auto;padding:6px 10px;border-radius:999px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.24);">
              <input type="checkbox" data-module-checkbox="${index}" disabled style="accent-color:#22c55e;cursor:not-allowed;" />
              Completed
            </label>
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
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <button type="button" data-progress-check-btn="${index}" style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.82rem;font-weight:700;">Submit Answer</button>
              <div data-progress-check-result="${index}" style="font-size:0.82rem;color:#9fb0c7;"></div>
            </div>
          </div>
        </section>
      `;
    }).join('');
  }

  function renderAssessment(rows) {
    const items = asArray(rows);
    if (!assessment) return;

    if (!items.length) {
      assessment.innerHTML = '<div class="module-item"><p>Assessment questions are not available yet.</p></div>';
      return;
    }

    assessment.innerHTML = items.map((item, i) => {
      const question = String(item?.question || '');
      const answer = String(item?.answer || '');
      return `
        <div class="module-item" style="margin-bottom:0;">
          <p style="margin-bottom:8px;"><strong style="color:#c4b5fd;">Question ${i + 1}:</strong> ${question}</p>
          <p style="margin-bottom:0;"><strong style="color:#a5b4fc;">Answer:</strong> ${answer}</p>
        </div>
      `;
    }).join('');
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

    renderAssessment(course?.finalAssessment);
    renderList(interviewPrep, course?.interviewPrep);
  }

  async function loadLearnerIdentity() {
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch('/api/me', {
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
    titleMain.textContent = `Loading ${topic}...`;
    titleSide.textContent = `Loading ${topic}...`;
    subtitleSide.textContent = forceRefresh ? 'Refreshing course version...' : 'Generating complete curriculum...';
    overview.textContent = forceRefresh ? 'Please wait while we create a fresh version of this course.' : 'Please wait while we build your full course.';
    if (modules) modules.innerHTML = '';
    if (assessment) assessment.innerHTML = '';
    if (capstone) capstone.innerHTML = '';
    if (interviewPrep) interviewPrep.innerHTML = '';
    if (outcomes) outcomes.innerHTML = '';
    if (resumeSignals) resumeSignals.innerHTML = '';

    try {
      const response = await fetch('/api/learning/course-content', {
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
      titleMain.textContent = topic;
      titleSide.textContent = topic;
      subtitleSide.textContent = 'Course generation failed';
      overview.textContent = String(error?.message || 'Unable to load course. Please try again.');
    } finally {
      setCourseLoadingState(false);
    }
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
