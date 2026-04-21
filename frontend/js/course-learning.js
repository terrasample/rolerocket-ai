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
  const certificateBtn = document.getElementById('downloadCourseCertificateBtn');

  const progressState = {
    totalModules: 0,
    completedModules: new Set(),
    learnerName: 'Learner'
  };

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function answerMatches(userAnswer, expectedAnswer) {
    const user = normalizeText(userAnswer);
    const expected = normalizeText(expectedAnswer);
    if (!user || !expected) return false;

    if (user === expected) return true;
    if (user.includes(expected) || expected.includes(user)) return true;

    const expectedTokens = expected.split(' ').filter((t) => t.length > 2);
    if (!expectedTokens.length) return false;
    const hitCount = expectedTokens.filter((token) => user.includes(token)).length;
    return hitCount >= Math.max(2, Math.ceil(expectedTokens.length * 0.6));
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

  function getCheckedModuleIndexes() {
    return Array.from(document.querySelectorAll('input[data-module-checkbox]'))
      .filter((el) => el.checked)
      .map((el) => Number(el.getAttribute('data-module-checkbox')))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => a - b);
  }

  function setPassedModuleUi(idx, source) {
    const moduleCheckbox = document.querySelector(`input[data-module-checkbox="${idx}"]`);
    const answerInput = document.querySelector(`input[data-progress-check-input="${idx}"]`);
    const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
    const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

    if (moduleCheckbox) {
      moduleCheckbox.checked = true;
    }
    if (answerInput) {
      answerInput.disabled = true;
      answerInput.value = answerInput.value || 'Passed';
      answerInput.style.opacity = '0.8';
    }
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

  async function saveProgress() {
    const token = getToken();
    if (!token || !topic) return;

    const completedModules = getCheckedModuleIndexes();
    progressState.completedModules = new Set(completedModules);
    updateProgressUi();

    try {
      await fetch('/api/learning/course-progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic,
          totalModules: progressState.totalModules,
          completedModules
        })
      });
    } catch (error) {
      // Keep UI state; user can continue even if autosave misses once.
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
      button.addEventListener('click', function () {
        const idx = Number(button.getAttribute('data-progress-check-btn'));
        if (progressState.completedModules.has(idx)) {
          setPassedModuleUi(idx, 'restored');
          return;
        }

        const answerInput = document.querySelector(`input[data-progress-check-input="${idx}"]`);
        const expectedInput = document.querySelector(`input[data-progress-check-answer="${idx}"]`);
        const resultWrap = document.querySelector(`div[data-progress-check-result="${idx}"]`);

        if (!answerInput || !expectedInput || !resultWrap) return;

        const userAnswer = answerInput.value;
        const expected = expectedInput.value;
        if (answerMatches(userAnswer, expected)) {
          progressState.completedModules.add(idx);
          setPassedModuleUi(idx, 'fresh');
          saveProgress();
        } else {
          resultWrap.textContent = 'Not quite. Review the module and try again.';
          resultWrap.style.color = '#fda4af';
        }
      });
    });

    document.querySelectorAll('input[data-progress-check-input]').forEach((input) => {
      input.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const idx = input.getAttribute('data-progress-check-input');
        const button = document.querySelector(`button[data-progress-check-btn="${idx}"]`);
        if (button && !button.disabled) button.click();
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
      const progressCheckAnswer = String(moduleItem?.progressCheckAnswer || title);

      return `
        <section class="module-item">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
            <h4 style="margin:0;">Module ${index + 1}: ${title}</h4>
            <label style="display:flex;align-items:center;gap:6px;color:#86efac;font-size:0.84rem;white-space:nowrap;">
              <input type="checkbox" data-module-checkbox="${index}" disabled style="accent-color:#22c55e;cursor:not-allowed;" />
              Completed
            </label>
          </div>
          <p><strong style="color:#93c5fd;">Objective:</strong> ${objective}</p>
          <p><strong style="color:#93c5fd;">Lesson:</strong> ${lesson}</p>
          <p><strong style="color:#93c5fd;">Worked Example:</strong> ${workedExample}</p>
          <p><strong style="color:#fda4af;">Common Mistake:</strong> ${commonMistake}</p>
          <p><strong style="color:#86efac;">Practice Task:</strong> ${practiceTask}</p>
          <div style="margin-top:12px;padding:10px;border-radius:8px;background:#0b1220;border:1px solid #273449;">
            <div style="font-size:0.82rem;color:#c4b5fd;font-weight:700;margin-bottom:6px;">Progress Check</div>
            <div style="color:#d0d9e7;font-size:0.9rem;line-height:1.55;margin-bottom:8px;">${progressCheckQuestion}</div>
            <input data-progress-check-input="${index}" type="text" placeholder="Type your answer" style="width:100%;margin-bottom:8px;background:#111c31;border:1px solid #2a3954;color:#f1f5f9;border-radius:6px;padding:8px;" />
            <input data-progress-check-answer="${index}" type="hidden" value="${escapeAttr(progressCheckAnswer)}" />
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <button type="button" data-progress-check-btn="${index}" style="background:#7c3aed;border:none;color:#fff;border-radius:6px;padding:7px 10px;cursor:pointer;font-size:0.82rem;font-weight:700;">Check Answer</button>
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

  async function loadCourse() {
    if (!topic) {
      titleMain.textContent = 'No course selected';
      titleSide.textContent = 'No course selected';
      overview.textContent = 'Return to the course catalog and choose a course card.';
      return;
    }

    titleMain.textContent = `Loading ${topic}...`;
    titleSide.textContent = `Loading ${topic}...`;
    subtitleSide.textContent = 'Generating complete curriculum...';
    overview.textContent = 'Please wait while we build your full course.';

    try {
      const response = await fetch('/api/learning/course-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ topic })
      });

      const payload = await response.json();
      if (!response.ok || !payload?.course) {
        throw new Error((payload && payload.error) || 'Unable to load course.');
      }

      renderCourse(payload.course);
      bindProgressHandlers();
      await loadProgress();
    } catch (error) {
      titleMain.textContent = topic;
      titleSide.textContent = topic;
      subtitleSide.textContent = 'Course generation failed';
      overview.textContent = String(error?.message || 'Unable to load course. Please try again.');
    }
  }

  certificateBtn?.addEventListener('click', downloadCertificate);
  loadLearnerIdentity();
  loadCourse();
});
