document.addEventListener('DOMContentLoaded', function () {
  const grid = document.getElementById('courseGrid');
  if (!grid) return;

  const progressByKey = new Map();

  const courses = [
    { id: 'python-programming', name: 'Python Programming', summary: 'Learn variables, functions, loops, and automation scripts.', demand: 'HOT' },
    { id: 'project-management', name: 'Project Management', summary: 'Manage scope, timelines, budgets, and stakeholders.', demand: 'HOT' },
    { id: 'scrum-agile', name: 'Scrum & Agile', summary: 'Master sprint planning, standups, and retrospectives.', demand: 'HOT' },
    { id: 'sql-data-analysis', name: 'SQL & Data Analysis', summary: 'Query databases, join tables, and extract business insights.', demand: 'HOT' },
    { id: 'ai-machine-learning', name: 'AI & Machine Learning', summary: 'Understand how AI models work and apply ML to real problems.', demand: 'HOT' },
    { id: 'cybersecurity-fundamentals', name: 'Cybersecurity Fundamentals', summary: 'Identify threats and apply security best practices.', demand: 'RISING' },
    { id: 'cloud-computing', name: 'Cloud Computing', summary: 'Learn cloud services, deployment models, and infrastructure.', demand: 'HOT' },
    { id: 'product-management', name: 'Product Management', summary: 'Define roadmaps, lead teams, and ship products users love.', demand: 'RISING' },
    { id: 'power-bi-data-viz', name: 'Power BI & Data Viz', summary: 'Build dashboards that turn raw data into business decisions.', demand: 'RISING' },
    { id: 'ux-design-principles', name: 'UX Design Principles', summary: 'Design user-centered interfaces with research and testing.', demand: 'RISING' },
    { id: 'advanced-excel', name: 'Advanced Excel', summary: 'Master PivotTables, VLOOKUP, Power Query, and macros.', demand: 'HOT' },
    { id: 'leadership-management', name: 'Leadership & Management', summary: 'Lead teams, give effective feedback, and manage performance.', demand: 'RISING' }
  ];

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function courseKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'course';
  }

  function cardHtml(course) {
    const isHot = course.demand === 'HOT';
    const badgeBg = isHot ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.16)';
    const badgeColor = isHot ? '#ef4444' : '#f59e0b';
    const key = courseKey(course.name);
    const progress = progressByKey.get(key) || null;
    const percent = Number(progress?.progressPercent || 0);
    const done = Number(progress?.completedCount || 0);
    const total = Number(progress?.totalModules || 0);
    const actionLabel = percent > 0 && percent < 100 ? 'Continue Course ->' : (percent >= 100 ? 'Review Course ->' : 'Start Lesson ->');

    return `
      <article class="course-card" data-course-id="${course.id}" style="background:#142138;border:1px solid #24334e;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;cursor:pointer;min-height:210px;transition:transform .15s ease,border-color .15s ease;">
        <div style="display:flex;justify-content:flex-end;">
          <span style="font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:999px;background:${badgeBg};color:${badgeColor};letter-spacing:.05em;">${course.demand}</span>
        </div>
        <h3 style="margin:0;color:#f8fafc;font-size:1.15rem;line-height:1.25;">${course.name}</h3>
        <p style="margin:0;color:#9fb0c7;font-size:0.92rem;line-height:1.4;flex:1;">${course.summary}</p>
        <div style="margin-top:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;color:#9fb0c7;font-size:0.78rem;margin-bottom:5px;">
            <span>${total > 0 ? `${done}/${total} modules` : 'No progress yet'}</span>
            <span>${percent}%</span>
          </div>
          <div style="height:6px;background:#0b1220;border-radius:999px;overflow:hidden;margin-bottom:10px;">
            <div style="height:100%;width:${Math.max(0, Math.min(100, percent))}%;background:linear-gradient(90deg,#22c55e,#38bdf8);"></div>
          </div>
          <button type="button" data-course-id="${course.id}" style="background:#2563eb;border:none;color:#fff;font-weight:700;border-radius:8px;padding:10px 12px;cursor:pointer;width:100%;font-size:0.95rem;">${actionLabel}</button>
        </div>
      </article>
    `;
  }

  function renderGrid() {
    grid.innerHTML = courses.map(cardHtml).join('');
  }

  async function loadCatalogProgress() {
    const token = getToken();
    if (!token) {
      renderGrid();
      return;
    }
    try {
      const response = await fetch('/api/learning/course-progress-list', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const payload = await response.json();
      if (response.ok && Array.isArray(payload?.items)) {
        payload.items.forEach((item) => {
          progressByKey.set(String(item.courseKey || ''), item);
        });
      }
    } catch (error) {
      // Render cards even if progress endpoint is unavailable.
    }
    renderGrid();
  }

  function openCourse(courseId) {
    const selected = courses.find((c) => c.id === courseId);
    if (!selected) return;
    const params = new URLSearchParams({ topic: selected.name });
    window.location.href = `course-learning.html?${params.toString()}`;
  }

  grid.addEventListener('click', function (event) {
    const target = event.target.closest('[data-course-id]');
    if (!target) return;
    openCourse(target.getAttribute('data-course-id'));
  });

  grid.addEventListener('mouseover', function (event) {
    const card = event.target.closest('.course-card');
    if (!card) return;
    card.style.transform = 'translateY(-2px)';
    card.style.borderColor = '#3b82f6';
  });

  grid.addEventListener('mouseout', function (event) {
    const card = event.target.closest('.course-card');
    if (!card) return;
    card.style.transform = '';
    card.style.borderColor = '#24334e';
  });

  loadCatalogProgress();
});
