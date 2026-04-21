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

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
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
          <h4>Module ${index + 1}: ${title}</h4>
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
    } catch (error) {
      titleMain.textContent = topic;
      titleSide.textContent = topic;
      subtitleSide.textContent = 'Course generation failed';
      overview.textContent = String(error?.message || 'Unable to load course. Please try again.');
    }
  }

  loadCourse();
});
