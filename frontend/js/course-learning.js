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

  const progressState = {
    totalModules: 0,
    completedModules: new Set()
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
  }

  function getCheckedModuleIndexes() {
    return Array.from(document.querySelectorAll('input[data-module-checkbox]'))
      .filter((el) => el.checked)
      .map((el) => Number(el.getAttribute('data-module-checkbox')))
      .filter((n) => Number.isInteger(n) && n >= 0)
      .sort((a, b) => a - b);
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

      updateProgressUi();
    } catch (error) {
      updateProgressUi();
    }
  }

  function bindProgressHandlers() {
    document.querySelectorAll('input[data-module-checkbox]').forEach((checkbox) => {
      checkbox.addEventListener('change', saveProgress);
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

      return `
        <section class="module-item">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
            <h4 style="margin:0;">Module ${index + 1}: ${title}</h4>
            <label style="display:flex;align-items:center;gap:6px;color:#86efac;font-size:0.84rem;white-space:nowrap;">
              <input type="checkbox" data-module-checkbox="${index}" style="accent-color:#22c55e;" />
              Completed
            </label>
          </div>
          <p><strong style="color:#93c5fd;">Objective:</strong> ${objective}</p>
          <p><strong style="color:#93c5fd;">Lesson:</strong> ${lesson}</p>
          <p><strong style="color:#93c5fd;">Worked Example:</strong> ${workedExample}</p>
          <p><strong style="color:#fda4af;">Common Mistake:</strong> ${commonMistake}</p>
          <p><strong style="color:#86efac;">Practice Task:</strong> ${practiceTask}</p>
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

  loadCourse();
});
