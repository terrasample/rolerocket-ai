document.addEventListener('DOMContentLoaded', function () {
  const grid = document.getElementById('courseGrid');
  const filterWrap = document.getElementById('courseDemandFilters');
  const filterSummary = document.getElementById('courseFilterSummary');
  const catalogSource = document.getElementById('courseCatalogSource');
  const hotCountBadge = document.getElementById('courseHotCountBadge');
  const risingCountBadge = document.getElementById('courseRisingCountBadge');
  const searchInput = document.getElementById('courseSearchInput');
  const clearSearchBtn = document.getElementById('courseSearchClearBtn');
  const preferenceStatus = document.getElementById('coursePreferenceStatus');
  if (!grid) return;

  const CATALOG_PREFS_KEY = 'learningCatalogPrefs';
  const progressByKey = new Map();
  let activeFilter = 'ALL';
  let searchTerm = '';
  let courses = [];

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function courseKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'course';
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function savePreferences() {
    try {
      localStorage.setItem(CATALOG_PREFS_KEY, JSON.stringify({
        activeFilter,
        searchTerm
      }));
      if (preferenceStatus) preferenceStatus.textContent = 'Search and filter preferences are saved on this device.';
    } catch (error) {
      if (preferenceStatus) preferenceStatus.textContent = 'Preferences could not be saved in this browser.';
    }
  }

  function loadPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CATALOG_PREFS_KEY) || '{}');
      const savedFilter = String(parsed?.activeFilter || 'ALL').toUpperCase();
      const savedSearch = String(parsed?.searchTerm || '').trim();
      activeFilter = ['ALL', 'HOT', 'RISING'].includes(savedFilter) ? savedFilter : 'ALL';
      searchTerm = savedSearch;
      if (searchInput) searchInput.value = searchTerm;
    } catch (error) {
      activeFilter = 'ALL';
      searchTerm = '';
    }
  }

  function matchesSearch(course) {
    const query = normalizeText(searchTerm);
    if (!query) return true;
    const haystack = normalizeText([
      course?.name,
      course?.summary,
      course?.demand,
      `rank ${course?.rank}`
    ].join(' '));
    return haystack.includes(query);
  }

  function cardHtml(course) {
    const isHot = course.demand === 'HOT';
    const badgeBg = isHot ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.16)';
    const badgeColor = isHot ? '#ef4444' : '#f59e0b';
    const rankBg = course.rank <= 5 ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#2563eb,#0ea5e9)';
    const key = courseKey(course.name);
    const progress = progressByKey.get(key) || null;
    const percent = Number(progress?.progressPercent || 0);
    const done = Number(progress?.completedCount || 0);
    const total = Number(progress?.totalModules || 0);
    const actionLabel = percent > 0 && percent < 100 ? 'Continue Course ->' : (percent >= 100 ? 'Review Course ->' : 'Start Lesson ->');

    return `
      <article class="course-card" data-course-id="${course.id}" style="background:#142138;border:1px solid #24334e;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px;cursor:pointer;min-height:210px;transition:transform .15s ease,border-color .15s ease;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <span style="font-size:0.76rem;font-weight:800;padding:6px 10px;border-radius:999px;background:${rankBg};color:#fff;letter-spacing:.04em;">#${course.rank}</span>
          <span style="font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:999px;background:${badgeBg};color:${badgeColor};letter-spacing:.05em;">${course.demand}</span>
        </div>
        <h3 style="margin:0;color:#f8fafc;font-size:1.15rem;line-height:1.25;">${course.name}</h3>
        <p style="margin:0;color:#9fb0c7;font-size:0.92rem;line-height:1.4;flex:1;">${course.summary}</p>
        <div style="margin-top:auto;">
          <div style="color:#7dd3fc;font-size:0.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px;">2026 Heat Rank</div>
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
    const visibleCourses = courses.filter((course) => (
      (activeFilter === 'ALL' || course.demand === activeFilter)
      && matchesSearch(course)
    ));
    if (filterSummary) {
      if (!visibleCourses.length) {
        filterSummary.textContent = searchTerm
          ? `No courses matched "${searchTerm}"`
          : 'No courses matched the selected filter';
      } else if (activeFilter === 'ALL') {
        filterSummary.textContent = searchTerm
          ? `Showing ${visibleCourses.length} search results`
          : `Showing all ${visibleCourses.length} courses`;
      } else {
        filterSummary.textContent = searchTerm
          ? `Showing ${visibleCourses.length} ${activeFilter.toLowerCase()} search results`
          : `Showing ${visibleCourses.length} ${activeFilter.toLowerCase()} courses`;
      }
    }
    grid.innerHTML = visibleCourses.length
      ? visibleCourses.map(cardHtml).join('')
      : '<div style="grid-column:1 / -1;background:#132039;border:1px solid #2b3a56;border-radius:14px;padding:20px;color:#cbd5e1;"><div style="font-size:1rem;font-weight:700;color:#f8fafc;margin-bottom:8px;">No courses found</div><div style="line-height:1.6;">Try a different keyword or switch back to another demand filter.</div></div>';
  }

  function updateFilterButtons() {
    if (!filterWrap) return;
    filterWrap.querySelectorAll('[data-course-filter]').forEach((button) => {
      const isActive = button.getAttribute('data-course-filter') === activeFilter;
      button.style.background = isActive ? '#2563eb' : 'transparent';
      button.style.borderColor = isActive ? '#3b82f6' : '#334155';
      button.style.color = isActive ? '#ffffff' : '#cbd5e1';
    });
  }

  function updateCatalogMeta(payload) {
    if (catalogSource) {
      const generatedAt = payload?.generatedAt ? new Date(payload.generatedAt).toLocaleString() : '';
      const sourceLabel = String(payload?.sourceLabel || 'Source: backend-generated catalog').trim();
      catalogSource.textContent = generatedAt ? `${sourceLabel} · Updated ${generatedAt}` : sourceLabel;
    }
    if (hotCountBadge) {
      hotCountBadge.textContent = `${Number(payload?.hotCount || 0)} HOT`;
    }
    if (risingCountBadge) {
      risingCountBadge.textContent = `${Number(payload?.risingCount || 0)} RISING`;
    }
  }

  async function loadCatalogData() {
    try {
      const response = await fetch('/api/learning/catalog');
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.items)) {
        throw new Error((payload && payload.error) || 'Unable to load catalog.');
      }
      courses = payload.items
        .map((item) => ({
          rank: Number(item.rank || 0),
          id: String(item.id || ''),
          name: String(item.name || ''),
          summary: String(item.summary || ''),
          demand: String(item.demand || 'RISING').toUpperCase()
        }))
        .filter((item) => item.id && item.name)
        .sort((left, right) => left.rank - right.rank);
      updateCatalogMeta(payload);
      renderGrid();
    } catch (error) {
      if (catalogSource) {
        catalogSource.textContent = 'Source: catalog endpoint unavailable';
      }
      if (preferenceStatus) {
        preferenceStatus.textContent = 'Catalog feed is unavailable right now. Please try again.';
      }
      courses = [];
      renderGrid();
    }
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

  if (filterWrap) {
    filterWrap.addEventListener('click', function (event) {
      const button = event.target.closest('[data-course-filter]');
      if (!button) return;
      activeFilter = String(button.getAttribute('data-course-filter') || 'ALL');
      updateFilterButtons();
      savePreferences();
      renderGrid();
    });
  }

  searchInput?.addEventListener('input', function () {
    searchTerm = String(searchInput.value || '').trim();
    savePreferences();
    renderGrid();
  });

  clearSearchBtn?.addEventListener('click', function () {
    searchTerm = '';
    if (searchInput) searchInput.value = '';
    savePreferences();
    renderGrid();
  });

  loadPreferences();
  updateFilterButtons();
  loadCatalogData().then(loadCatalogProgress);
});
