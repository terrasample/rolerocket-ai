document.addEventListener('DOMContentLoaded', function () {
  const targetRoleInput = document.getElementById('learningTargetRole');
  const currentLevelInput = document.getElementById('learningCurrentLevel');
  const timePerWeekInput = document.getElementById('learningTimePerWeek');
  const jobDescriptionInput = document.getElementById('learningJobDescription');
  const resumeInput = document.getElementById('learningResume');

  const generateBtn = document.getElementById('generateLearningPlanBtn');
  const clearBtn = document.getElementById('clearLearningFieldsBtn');
  const resultWrap = document.getElementById('learningResultWrap');
  const downloadsWrap = document.getElementById('learningDownloads');
  const planText = document.getElementById('learningPlanText');
  const structuredOutput = document.getElementById('learningStructuredOutput');
  const output = document.getElementById('learningOutput');
  const pdfBtn = document.getElementById('downloadLearningPdfBtn');
  const wordBtn = document.getElementById('downloadLearningWordBtn');
  const historyList = document.getElementById('learningHistoryList');

  function setMessage(message, color) {
    output.innerHTML = message ? `<div style="margin-top:12px;color:${color};">${message}</div>` : '';
  }

  function getToken() {
    return (typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')) || '';
  }

  function slugify(value) {
    return String(value || 'learning-roadmap')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'learning-roadmap';
  }

  function getFileBaseName() {
    return slugify(`${targetRoleInput?.value || 'role'}-learning-roadmap`);
  }

  function clearFields() {
    if (targetRoleInput) targetRoleInput.value = '';
    if (currentLevelInput) currentLevelInput.value = '';
    if (timePerWeekInput) timePerWeekInput.value = '5';
    if (jobDescriptionInput) jobDescriptionInput.value = '';
    if (resumeInput) resumeInput.value = '';
    if (planText) planText.value = '';
    if (structuredOutput) structuredOutput.innerHTML = '';
    if (resultWrap) resultWrap.style.display = 'none';
    if (downloadsWrap) downloadsWrap.style.display = 'none';
    setMessage('Fields cleared.', '#16a34a');
  }

  function parseRoadmapSections(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];

    const lines = raw.split('\n');
    const sections = [];
    let current = null;

    lines.forEach((line) => {
      const normalized = String(line || '').trim().replace(/\*\*/g, '');
      const headingMatch = normalized.match(/^(?:#{1,6}\s*)?(\d+)\)\s+(.+)$/);
      if (headingMatch) {
        if (current) sections.push(current);
        current = {
          index: Number(headingMatch[1]),
          title: String(headingMatch[2] || '').trim(),
          lines: []
        };
        return;
      }

      if (!current) {
        current = { index: 0, title: 'Overview', lines: [] };
      }
      current.lines.push(line);
    });

    if (current) sections.push(current);
    return sections;
  }

  function parseTeachingModules(sectionLines) {
    const lines = Array.isArray(sectionLines) ? sectionLines : [];
    const modules = [];
    let current = null;
    let currentField = null;

    function ensureCurrentModule() {
      if (!current) {
        current = {
          skill: '',
          why: '',
          learn: '',
          practice: '',
          proof: '',
          fallback: ''
        };
      }
    }

    function saveCurrentField() {
      if (currentField && current) {
        current[currentField] = String(current[currentField] || '').trim();
      }
      currentField = null;
    }

    lines.forEach((rawLine) => {
      const line = normalizeParsingLine(rawLine);
      if (!line) return;

      const moduleMatch = line.match(/^Module\s*\d+\s*:\s*(.+)$/i);
      if (moduleMatch) {
        if (current && (current.skill || current.why || current.learn || current.practice || current.proof || current.fallback)) {
          modules.push(current);
        }
        current = {
          skill: String(moduleMatch[1] || '').trim(),
          why: '',
          learn: '',
          practice: '',
          proof: '',
          fallback: ''
        };
        currentField = null;
        return;
      }

      const keyMatch = line.match(/^(Why this matters|Learn|Practice|Proof(?: of mastery)?)\s*:\s*(.*)$/i);
      if (keyMatch) {
        ensureCurrentModule();
        saveCurrentField();

        const keyName = keyMatch[1].toLowerCase();
        const value = String(keyMatch[2] || '').trim();

        if (keyName.includes('why this matters')) {
          currentField = 'why';
          current.why = value;
        } else if (keyName === 'learn') {
          currentField = 'learn';
          current.learn = value;
        } else if (keyName === 'practice') {
          currentField = 'practice';
          current.practice = value;
        } else if (keyName.includes('proof')) {
          currentField = 'proof';
          current.proof = value;
        }
        return;
      }

      ensureCurrentModule();
      if (currentField && current) {
        current[currentField] += (current[currentField] ? ' ' : '') + line;
      } else {
        current.fallback += (current.fallback ? '\n' : '') + line;
      }
    });

    if (current && (current.skill || current.why || current.learn || current.practice || current.proof || current.fallback)) {
      saveCurrentField();
      modules.push(current);
    }

    return modules;
  }

  function parseTrendingCourses(sectionLines) {
    const raw = String((sectionLines || []).join('\n') || '').trim();
    const courses = [];

    raw.split('\n').forEach((rawLine) => {
      const line = normalizeParsingLine(rawLine);
      if (!line) return;

      // Match pipe-delimited format: Course Name: X | Platform: Y | Why it is trending: Z | Best for: W
      const nameMatch = line.match(/Course Name:\s*([^|]+)/i);
      const platformMatch = line.match(/Platform:\s*([^|]+)/i);
      const trendingMatch = line.match(/Why it is trending:\s*([^|]+)/i);
      const bestForMatch = line.match(/Best for:\s*(.+)/i);

      if (nameMatch) {
        courses.push({
          name: String(nameMatch[1] || '').trim(),
          platform: String((platformMatch && platformMatch[1]) || '').trim(),
          trending: String((trendingMatch && trendingMatch[1]) || '').trim(),
          bestFor: String((bestForMatch && bestForMatch[1]) || '').trim()
        });
      }
    });

    return courses;
  }

  function attachModuleTabs() {
    if (!structuredOutput) return;

    structuredOutput.querySelectorAll('[data-module-card]').forEach((card) => {
      const tabButtons = card.querySelectorAll('[data-module-tab]');
      const panes = card.querySelectorAll('[data-module-pane]');
      if (!tabButtons.length || !panes.length) return;

      tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const target = button.getAttribute('data-module-tab') || '';
          tabButtons.forEach((btn) => {
            const isActive = btn === button;
            btn.style.background = isActive ? '#0ea5e9' : '#e2e8f0';
            btn.style.color = isActive ? '#ffffff' : '#0f172a';
          });
          panes.forEach((pane) => {
            pane.style.display = pane.getAttribute('data-module-pane') === target ? 'block' : 'none';
          });
        });
      });
    });
  }

  function renderStructuredRoadmap(text) {
    if (!structuredOutput) return;

    const sections = parseRoadmapSections(text);
    if (!sections.length) {
      structuredOutput.innerHTML = '<div style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#475569;">No learning sections found.</div>';
      return;
    }

    structuredOutput.innerHTML = sections.map((section, sectionIdx) => {
      const safeTitle = escapeHtml(section.title || `Section ${section.index || sectionIdx + 1}`);

      if (/skill teaching modules/i.test(section.title || '')) {
        const modules = parseTeachingModules(section.lines || []);
        if (!modules.length) {
          return `
            <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
              <h4 style="margin:0 0 8px 0;color:#0f172a;">${safeTitle}</h4>
              <div style="white-space:pre-wrap;color:#334155;line-height:1.6;">${escapeHtml((section.lines || []).join('\n').trim())}</div>
            </article>
          `;
        }

        const moduleCards = modules.map((module, moduleIdx) => {
          const tabPrefix = `module-${sectionIdx}-${moduleIdx}`;
          const title = escapeHtml(module.skill || `Skill Module ${moduleIdx + 1}`);
          const why = renderInlineMarkdown(module.why || module.fallback || 'No details provided.');
          const learn = renderInlineMarkdown(module.learn || module.fallback || 'No details provided.');
          const practice = renderInlineMarkdown(module.practice || module.fallback || 'No details provided.');
          const proof = renderInlineMarkdown(module.proof || module.fallback || 'No details provided.');

          return `
            <div data-module-card style="border:1px solid #dbe3ea;border-radius:10px;padding:12px;background:#f8fafc;">
              <div style="font-weight:700;color:#0f172a;margin-bottom:8px;">${title}</div>
              <div style="font-size:0.84rem;color:#475569;margin-bottom:10px;">Follow this teaching path in order: Why -> Lesson -> Practice -> Mastery</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button type="button" data-module-tab="${tabPrefix}-why" style="padding:6px 10px;border:none;border-radius:999px;background:#0ea5e9;color:#ffffff;font-size:0.85rem;cursor:pointer;">1) Why</button>
                <button type="button" data-module-tab="${tabPrefix}-learn" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">2) Lesson</button>
                <button type="button" data-module-tab="${tabPrefix}-practice" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">3) Practice</button>
                <button type="button" data-module-tab="${tabPrefix}-proof" style="padding:6px 10px;border:none;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:0.85rem;cursor:pointer;">4) Mastery</button>
              </div>
              <div data-module-pane="${tabPrefix}-why" style="display:block;color:#334155;line-height:1.6;"><strong>Why this skill matters:</strong> ${why}</div>
              <div data-module-pane="${tabPrefix}-learn" style="display:none;color:#334155;line-height:1.6;"><strong>Teach me:</strong> ${learn}</div>
              <div data-module-pane="${tabPrefix}-practice" style="display:none;color:#334155;line-height:1.6;"><strong>Your drill:</strong> ${practice}</div>
              <div data-module-pane="${tabPrefix}-proof" style="display:none;color:#334155;line-height:1.6;"><strong>Mastery check:</strong> ${proof}</div>
            </div>
          `;
        }).join('');

        return `
          <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
            <h4 style="margin:0 0 10px 0;color:#0f172a;">${safeTitle}</h4>
            <div style="display:grid;gap:10px;">${moduleCards}</div>
          </article>
        `;
      }

      if (/trending industry courses/i.test(section.title || '')) {
        const courses = parseTrendingCourses(section.lines || []);
        if (!courses.length) {
          return `
            <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
              <h4 style="margin:0 0 8px 0;color:#0f172a;">${safeTitle}</h4>
              <div style="white-space:pre-wrap;color:#334155;line-height:1.6;">${escapeHtml((section.lines || []).join('\n').trim())}</div>
            </article>
          `;
        }

        const courseCards = courses.map((course) => `
          <div style="border:1px solid #bfdbfe;border-radius:10px;padding:14px;background:#eff6ff;display:grid;gap:6px;">
            <div style="font-weight:700;color:#1e40af;font-size:1rem;">${escapeHtml(course.name)}</div>
            ${course.platform ? `<div style="font-size:0.88rem;color:#2563eb;font-weight:600;">📚 ${escapeHtml(course.platform)}</div>` : ''}
            ${course.trending ? `<div style="font-size:0.91rem;color:#334155;"><span style="font-weight:600;">Why it's trending:</span> ${escapeHtml(course.trending)}</div>` : ''}
            ${course.bestFor ? `<div style="font-size:0.91rem;color:#334155;"><span style="font-weight:600;">Best for:</span> ${escapeHtml(course.bestFor)}</div>` : ''}
          </div>
        `).join('');

        return `
          <article style="border:2px solid #bfdbfe;border-radius:12px;background:#f0f9ff;padding:14px;">
            <h4 style="margin:0 0 10px 0;color:#1e40af;">🔥 ${safeTitle}</h4>
            <div style="display:grid;gap:10px;">${courseCards}</div>
          </article>
        `;
      }

      const bodyLines = (section.lines || [])
        .map((line) => normalizeParsingLine(line))
        .filter((line) => String(line || '').trim().length);
      const body = bodyLines.length
        ? `<ul style="margin:0 0 0 18px;padding:0;display:grid;gap:6px;color:#334155;line-height:1.6;">${bodyLines.map((line) => `<li>${renderInlineMarkdown(line)}</li>`).join('')}</ul>`
        : '<div style="color:#64748b;">No items listed.</div>';

      return `
        <article style="border:1px solid #dbe3ea;border-radius:12px;background:#ffffff;padding:14px;">
          <h4 style="margin:0 0 8px 0;color:#0f172a;">${safeTitle}</h4>
          ${body}
        </article>
      `;
    }).join('');

    attachModuleTabs();
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function truncate(text, max = 220) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1).trim()}...`;
  }

  function normalizeParsingLine(value) {
    return String(value || '')
      .replace(/^\s*[-*]\s*/, '')
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
  }

  function renderInlineMarkdown(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    const parts = text.split('**');
    return parts.map((part, idx) => {
      const safe = escapeHtml(part);
      return idx % 2 === 1 ? `<strong>${safe}</strong>` : safe;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openResumeGeneratorWithRoadmap(item) {
    const payload = {
      targetRole: String(item?.targetRole || '').trim(),
      roadmapText: String(item?.roadmapText || '').trim(),
      createdAt: item?.createdAt || new Date().toISOString()
    };

    try {
      sessionStorage.setItem('learning-selected-roadmap-v1', JSON.stringify(payload));
    } catch (err) {
      // Ignore session storage issues and continue navigation.
    }

    window.location.href = 'resume-generator.html?fromLearning=1';
  }

  function showPreviousSessionBanner(count) {
    const banner = document.getElementById('learningPreviousSessionBanner');
    if (!banner) return;
    if (count > 0) {
      banner.textContent = `\u{1F4A1} You have ${count} saved learning plan${count === 1 ? '' : 's'} from previous sessions \u2014 see history below to reload one.`;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  function renderHistory(items) {
    if (!historyList) return;

    const list = Array.isArray(items) ? items : [];
    showPreviousSessionBanner(list.length);
    if (!list.length) {
      historyList.innerHTML = '<div style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;background:#f8fafc;">No saved learning roadmaps yet.</div>';
      return;
    }

    historyList.innerHTML = list.map((item, idx) => {
      const title = String(item.targetRole || 'Target Role').trim();
      const summary = truncate(item.roadmapText || '');
      const created = formatDate(item.createdAt);
      return `
        <div style="text-align:left;padding:12px;border:1px solid #dbe3ea;border-radius:10px;background:#ffffff;">
          <div style="font-weight:700;color:#1e293b;">${title}</div>
          <div style="font-size:0.92rem;color:#64748b;margin-top:4px;">${created}</div>
          <div style="font-size:0.95rem;color:#334155;margin-top:8px;line-height:1.55;">${escapeHtml(summary)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
            <button type="button" data-history-load-idx="${idx}" class="feature-launch-btn" style="padding:8px 12px;font-size:0.88rem;">Load Here</button>
            <button type="button" data-history-apply-idx="${idx}" class="feature-launch-btn" style="padding:8px 12px;font-size:0.88rem;background:#334155;">Apply to Resume Generator</button>
          </div>
        </div>
      `;
    }).join('');

    historyList.querySelectorAll('button[data-history-load-idx]').forEach((button) => {
      button.addEventListener('click', () => {
        const idx = Number(button.getAttribute('data-history-load-idx'));
        const selected = list[idx];
        if (!selected) return;

        if (planText) planText.value = String(selected.roadmapText || '');
        renderStructuredRoadmap(String(selected.roadmapText || ''));
        if (resultWrap) resultWrap.style.display = 'block';
        if (downloadsWrap) downloadsWrap.style.display = 'block';
        const roleLabel = String(selected.targetRole || 'previous session').trim();
        setMessage(`Showing your saved roadmap for \u201C${roleLabel}\u201D. To regenerate, fill in the fields above and click the button.`, '#2563eb');
      });
    });

    historyList.querySelectorAll('button[data-history-apply-idx]').forEach((button) => {
      button.addEventListener('click', () => {
        const idx = Number(button.getAttribute('data-history-apply-idx'));
        const selected = list[idx];
        if (!selected) return;
        openResumeGeneratorWithRoadmap(selected);
      });
    });
  }

  async function loadLearningHistory() {
    const token = getToken();
    if (!token) {
      renderHistory([]);
      return;
    }

    try {
      const res = await fetch('/api/learning/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        renderHistory([]);
        return;
      }
      renderHistory(data.items || []);
    } catch (err) {
      renderHistory([]);
    }
  }

  function formatPdf(text, doc) {
    let y = 22;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('RoleRocketAI Learning Roadmap', 18, y);
    y += 10;
    doc.setFont('times', 'normal');
    doc.setFontSize(12);

    text.split('\n').forEach((line) => {
      const wrapped = line.trim() ? doc.splitTextToSize(line, 174) : [''];
      wrapped.forEach((part) => {
        if (y > 276) {
          doc.addPage();
          y = 22;
        }
        doc.text(part, 18, y);
        y += 7;
      });
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  generateBtn?.addEventListener('click', async function () {
    const targetRole = String(targetRoleInput?.value || '').trim();
    const currentLevel = String(currentLevelInput?.value || '').trim();
    const timePerWeek = String(timePerWeekInput?.value || '5').trim();
    const jobDescription = String(jobDescriptionInput?.value || '').trim();
    const resumeText = String(resumeInput?.value || '').trim();

    if (!targetRole || !jobDescription) {
      setMessage('Please add a target role and job description.', '#dc2626');
      return;
    }

    const token = getToken();
    if (!token) {
      setMessage('Please log in to use RoleRocketAI Learning.', '#dc2626');
      return;
    }

    setMessage('Analyzing missing skills and building your skill-teaching plan...', '#2563eb');

    try {
      const res = await fetch('/api/learning/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetRole,
          currentLevel,
          timePerWeek,
          jobDescription,
          resumeText
        })
      });

      const data = await res.json();
      if (!res.ok || !data.result) {
        setMessage((data && data.error) || 'Failed to generate learning roadmap.', '#dc2626');
        return;
      }

      planText.value = String(data.result || '').trim();
      renderStructuredRoadmap(planText.value);
      resultWrap.style.display = 'block';
      downloadsWrap.style.display = 'block';
      setMessage('Missing skills analysis and learning plan generated.', '#16a34a');
      loadLearningHistory();
    } catch (err) {
      setMessage('Error generating learning roadmap.', '#dc2626');
    }
  });

  clearBtn?.addEventListener('click', clearFields);

  pdfBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
      return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setMessage('PDF library not loaded.', '#dc2626');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    formatPdf(text, doc);
    doc.save(`${getFileBaseName()}.pdf`);
    setMessage('PDF downloaded.', '#16a34a');
  });

  wordBtn?.addEventListener('click', function () {
    const text = String(planText?.value || '').trim();
    if (!text) {
      setMessage('Generate a roadmap before downloading.', '#dc2626');
      return;
    }
    const html = `<!DOCTYPE html><html><body style="font-family:'Times New Roman', Times, serif;font-size:12pt;line-height:1.5;color:#000;">${text.split('\n').map((line) => `<p style="margin:0 0 10pt 0;">${line || '&nbsp;'}</p>`).join('')}</body></html>`;
    downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${getFileBaseName()}.doc`);
    setMessage('Word document downloaded.', '#16a34a');
  });

  loadLearningHistory();
});

// ─── In-Demand Skills Library ────────────────────────────────────────────────
(function initCourseLibrary() {
  const COURSES = [
    { id: 'python',              name: 'Python Programming',         cat: 'tech',     icon: '🐍', tag: 'Learn variables, functions, loops, and automation scripts.',   demand: 'Hot' },
    { id: 'project-management', name: 'Project Management',         cat: 'business', icon: '📋', tag: 'Manage scope, timelines, budgets, and stakeholders.',           demand: 'Hot' },
    { id: 'scrum-agile',        name: 'Scrum & Agile',              cat: 'business', icon: '🔄', tag: 'Master sprint planning, standups, and retrospectives.',         demand: 'Hot' },
    { id: 'sql-data',           name: 'SQL & Data Analysis',        cat: 'data',     icon: '🗃️', tag: 'Query databases, join tables, and extract business insights.',  demand: 'Hot' },
    { id: 'ai-ml',              name: 'AI & Machine Learning',      cat: 'tech',     icon: '🤖', tag: 'Understand how AI models work and apply ML to real problems.',  demand: 'Hot' },
    { id: 'cybersecurity',      name: 'Cybersecurity Fundamentals', cat: 'tech',     icon: '🔒', tag: 'Identify threats and apply security best practices.',           demand: 'Rising' },
    { id: 'cloud-computing',    name: 'Cloud Computing',            cat: 'tech',     icon: '☁️', tag: 'Learn cloud services, deployment models, and infrastructure.',  demand: 'Hot' },
    { id: 'product-management', name: 'Product Management',         cat: 'business', icon: '📱', tag: 'Define roadmaps, lead teams, and ship products users love.',    demand: 'Rising' },
    { id: 'power-bi',           name: 'Power BI & Data Viz',        cat: 'data',     icon: '📊', tag: 'Build dashboards that turn raw data into business decisions.',  demand: 'Rising' },
    { id: 'ux-design',          name: 'UX Design Principles',       cat: 'design',   icon: '🎨', tag: 'Design user-centered interfaces with research and testing.',   demand: 'Rising' },
    { id: 'advanced-excel',     name: 'Advanced Excel',             cat: 'data',     icon: '📈', tag: 'Master PivotTables, VLOOKUP, Power Query, and macros.',        demand: 'Hot' },
    { id: 'leadership',         name: 'Leadership & Management',    cat: 'business', icon: '🧭', tag: 'Lead teams, give effective feedback, and manage performance.',  demand: 'Rising' },
  ];

  const grid = document.getElementById('courseGrid');
  const filterBtns = document.querySelectorAll('.course-filter-btn');
  const lessonPanel = document.getElementById('courseLessonPanel');
  const lessonTitle = document.getElementById('courseLessonTitle');
  const lessonBadge = document.getElementById('courseLessonBadge');
  const lessonLoading = document.getElementById('courseLessonLoading');
  const lessonContent = document.getElementById('courseLessonContent');
  const closeBtn = document.getElementById('closeLessonBtn');

  if (!grid) return;

  let activeCat = 'all';
  let activeCard = null;

  function renderGrid(cat) {
    const filtered = cat === 'all' ? COURSES : COURSES.filter((c) => c.cat === cat);
    grid.innerHTML = filtered.map((course) => {
      const demandColor = course.demand === 'Hot' ? '#ef4444' : '#f59e0b';
      return `<div class="course-card" data-id="${course.id}" role="button" tabindex="0" aria-label="Start lesson: ${course.name}" style="background:#1e293b;border-radius:12px;padding:18px 16px;cursor:pointer;border:1px solid #334155;transition:border-color .2s,transform .15s;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:1.9rem;">${course.icon}</span>
          <span style="font-size:0.72rem;font-weight:700;color:${demandColor};background:${demandColor}18;padding:3px 8px;border-radius:12px;letter-spacing:0.04em;">${course.demand.toUpperCase()}</span>
        </div>
        <div style="font-weight:700;color:#f1f5f9;font-size:0.97rem;line-height:1.3;">${course.name}</div>
        <div style="font-size:0.83rem;color:#94a3b8;line-height:1.4;flex:1;">${course.tag}</div>
        <button class="start-lesson-btn" data-id="${course.id}" style="margin-top:4px;padding:7px 0;border-radius:7px;border:none;background:#2563eb;color:#fff;font-size:0.83rem;font-weight:600;cursor:pointer;width:100%;">Start Lesson →</button>
      </div>`;
    }).join('');
  }

  function parseLessonHtml(raw) {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    let html = '';
    lines.forEach((line) => {
      const introMatch = line.match(/^Introduction:\s*(.+)$/i);
      if (introMatch) {
        html += `<p style="color:#cbd5e1;font-style:italic;margin:0 0 18px 0;padding:12px 16px;background:#0f172a;border-radius:8px;border-left:3px solid #3b82f6;">${introMatch[1]}</p>`;
        return;
      }
      const conceptMatch = line.match(/^Concept\s*\d+:\s*([^:]+):\s*(.+)$/i);
      if (conceptMatch) {
        html += `<div style="margin:0 0 16px 0;padding:14px 16px;background:#0f172a;border-radius:8px;">
          <div style="font-weight:700;color:#60a5fa;font-size:0.87rem;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">${conceptMatch[1].trim()}</div>
          <div style="color:#e2e8f0;line-height:1.7;">${conceptMatch[2].trim()}</div>
        </div>`;
        return;
      }
      const mistakeMatch = line.match(/^Common Mistake:\s*(.+)$/i);
      if (mistakeMatch) {
        html += `<div style="margin:0 0 16px 0;padding:14px 16px;background:#2d1515;border-radius:8px;border-left:3px solid #ef4444;">
          <div style="font-weight:700;color:#f87171;font-size:0.87rem;margin-bottom:6px;">⚠ COMMON MISTAKE</div>
          <div style="color:#fca5a5;line-height:1.7;">${mistakeMatch[1].trim()}</div>
        </div>`;
        return;
      }
      const exerciseMatch = line.match(/^Exercise:\s*(.+)$/i);
      if (exerciseMatch) {
        html += `<div style="margin:0 0 16px 0;padding:14px 16px;background:#0c1a10;border-radius:8px;border-left:3px solid #22c55e;">
          <div style="font-weight:700;color:#4ade80;font-size:0.87rem;margin-bottom:6px;">✏ HANDS-ON EXERCISE</div>
          <div style="color:#bbf7d0;line-height:1.7;">${exerciseMatch[1].trim()}</div>
        </div>`;
        return;
      }
      const quickCheckMatch = line.match(/^Quick Check:\s*(.+)$/i);
      if (quickCheckMatch) {
        html += `<div style="margin:0 0 8px 0;padding:14px 16px;background:#16213e;border-radius:8px;border-left:3px solid #a78bfa;">
          <div style="font-weight:700;color:#c4b5fd;font-size:0.87rem;margin-bottom:6px;">💡 QUICK CHECK</div>
          <div style="color:#e2e8f0;line-height:1.7;">${quickCheckMatch[1].trim()}</div>`;
        return;
      }
      const answerMatch = line.match(/^Answer:\s*(.+)$/i);
      if (answerMatch) {
        html += `<div style="margin-top:8px;padding:10px 12px;background:#1e1b3a;border-radius:6px;color:#c4b5fd;font-size:0.9rem;line-height:1.6;"><strong>Answer:</strong> ${answerMatch[1].trim()}</div></div>`;
        return;
      }
      html += `<p style="color:#e2e8f0;margin:0 0 10px 0;">${line}</p>`;
    });
    return html;
  }

  async function startLesson(courseId) {
    const course = COURSES.find((c) => c.id === courseId);
    if (!course) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';

    lessonTitle.textContent = course.name;
    lessonBadge.textContent = course.cat.charAt(0).toUpperCase() + course.cat.slice(1);
    lessonContent.innerHTML = '';
    lessonLoading.style.display = 'block';
    lessonPanel.style.display = 'block';
    lessonPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const res = await fetch('/api/learning/course-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: course.name })
      });
      const data = await res.json();
      lessonLoading.style.display = 'none';
      if (!res.ok || !data.lesson) {
        lessonContent.innerHTML = `<div style="color:#f87171;">${(data && data.error) || 'Failed to generate lesson. Please try again.'}</div>`;
        return;
      }
      lessonContent.innerHTML = parseLessonHtml(data.lesson);
    } catch (err) {
      lessonLoading.style.display = 'none';
      lessonContent.innerHTML = '<div style="color:#f87171;">Error loading lesson. Please try again.</div>';
    }
  }

  grid.addEventListener('click', function (e) {
    const btn = e.target.closest('.start-lesson-btn');
    const card = e.target.closest('.course-card');
    const id = (btn || card)?.dataset?.id;
    if (id) startLesson(id);
  });

  grid.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.course-card');
      if (card?.dataset?.id) startLesson(card.dataset.id);
    }
  });

  closeBtn?.addEventListener('click', function () {
    lessonPanel.style.display = 'none';
    lessonContent.innerHTML = '';
    activeCard = null;
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', function () {
      filterBtns.forEach((b) => {
        b.style.background = 'transparent';
        b.style.borderColor = '#475569';
        b.style.color = '#94a3b8';
        b.classList.remove('active-filter');
      });
      btn.style.background = '#1e40af';
      btn.style.borderColor = '#3b82f6';
      btn.style.color = '#fff';
      btn.classList.add('active-filter');
      activeCat = btn.dataset.cat;
      renderGrid(activeCat);
      lessonPanel.style.display = 'none';
    });
  });

  // Card hover effects via event delegation
  grid.addEventListener('mouseover', function (e) {
    const card = e.target.closest('.course-card');
    if (card) { card.style.borderColor = '#3b82f6'; card.style.transform = 'translateY(-2px)'; }
  });
  grid.addEventListener('mouseout', function (e) {
    const card = e.target.closest('.course-card');
    if (card) { card.style.borderColor = '#334155'; card.style.transform = ''; }
  });

  renderGrid('all');
}());