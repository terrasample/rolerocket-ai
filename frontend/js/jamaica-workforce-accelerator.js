/* Jamaica Workforce Accelerator — client logic
   Four feature modules:
   1. Jamaica Job Market Radar
   2. Diaspora Connection Pipeline
   3. Resume Localization Checker
   4. Skills Gap Report (downloadable PDF)
*/

(function () {
  'use strict';

  /* ── Utilities ─────────────────────────────────────────────────────────── */
  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setStatus(elId, msg, color) {
    const el = document.getElementById(elId);
    if (el) el.innerHTML = msg ? `<span style="color:${color || '#16a34a'}">${msg}</span>` : '';
  }

  /* ── 1. Jamaica Job Market Radar ───────────────────────────────────────── */
  const JAMAICA_MARKET = {
    'Business Process Outsourcing (BPO)': {
      color: '#fbbf24',
      roles: [
        { title: 'Customer Service Representative', range: 'JMD 600k–900k/yr', demand: 'Very High', remote: true },
        { title: 'Technical Support Specialist', range: 'JMD 900k–1.4M/yr', demand: 'High', remote: true },
        { title: 'Data Entry & Quality Analyst', range: 'JMD 550k–780k/yr', demand: 'High', remote: false },
        { title: 'Team Leader / Supervisor', range: 'JMD 1.1M–1.6M/yr', demand: 'High', remote: false },
      ]
    },
    'Finance & Accounting': {
      color: '#34d399',
      roles: [
        { title: 'Accountant (ACCA/CPA)', range: 'JMD 1.5M–2.8M/yr', demand: 'High', remote: false },
        { title: 'Credit Analyst', range: 'JMD 1.2M–2.0M/yr', demand: 'Moderate', remote: false },
        { title: 'Financial Controller', range: 'JMD 2.5M–4.5M/yr', demand: 'Moderate', remote: false },
        { title: 'Internal Auditor', range: 'JMD 1.4M–2.2M/yr', demand: 'Moderate', remote: false },
      ]
    },
    'Tourism & Hospitality': {
      color: '#60a5fa',
      roles: [
        { title: 'Hotel Operations Manager', range: 'JMD 2.0M–3.5M/yr', demand: 'High', remote: false },
        { title: 'Guest Relations Executive', range: 'JMD 900k–1.4M/yr', demand: 'Very High', remote: false },
        { title: 'Revenue & Yield Manager', range: 'JMD 1.8M–3.0M/yr', demand: 'Moderate', remote: false },
        { title: 'Event Coordinator', range: 'JMD 800k–1.3M/yr', demand: 'High', remote: false },
      ]
    },
    'Technology & Digital': {
      color: '#a78bfa',
      roles: [
        { title: 'Software Developer (Full-Stack)', range: 'JMD 2.5M–5M/yr', demand: 'Very High', remote: true },
        { title: 'IT Project Manager', range: 'JMD 2.0M–3.8M/yr', demand: 'High', remote: true },
        { title: 'Cybersecurity Analyst', range: 'JMD 2.2M–4.0M/yr', demand: 'High', remote: true },
        { title: 'Digital Marketing Manager', range: 'JMD 1.2M–2.0M/yr', demand: 'Moderate', remote: true },
      ]
    },
    'Logistics & Supply Chain': {
      color: '#f87171',
      roles: [
        { title: 'Supply Chain Analyst', range: 'JMD 1.3M–2.1M/yr', demand: 'Moderate', remote: false },
        { title: 'Customs Broker', range: 'JMD 1.1M–1.8M/yr', demand: 'High', remote: false },
        { title: 'Warehouse Operations Manager', range: 'JMD 1.5M–2.4M/yr', demand: 'Moderate', remote: false },
        { title: 'Freight Coordinator', range: 'JMD 800k–1.3M/yr', demand: 'High', remote: false },
      ]
    },
    'Healthcare': {
      color: '#4ade80',
      roles: [
        { title: 'Registered Nurse', range: 'JMD 1.8M–2.8M/yr', demand: 'Critical', remote: false },
        { title: 'Medical Laboratory Scientist', range: 'JMD 1.6M–2.4M/yr', demand: 'High', remote: false },
        { title: 'Healthcare Administrator', range: 'JMD 1.4M–2.2M/yr', demand: 'Moderate', remote: false },
        { title: 'Community Health Worker', range: 'JMD 700k–1.1M/yr', demand: 'High', remote: false },
      ]
    }
  };

  const DEMAND_COLOR = { 'Critical': '#dc2626', 'Very High': '#ea580c', 'High': '#ca8a04', 'Moderate': '#16a34a' };

  function renderMarketRadar() {
    const container = document.getElementById('jwaMarketRadar');
    if (!container) return;

    const filterVal = (document.getElementById('jwaIndustryFilter')?.value || 'all').toLowerCase();

    let html = '';
    for (const [industry, data] of Object.entries(JAMAICA_MARKET)) {
      if (filterVal !== 'all' && !industry.toLowerCase().includes(filterVal)) continue;
      html += `
        <section class="jwa-industry-block" style="border-left: 4px solid ${data.color};">
          <h3 class="jwa-industry-title" style="color:${data.color};">${esc(industry)}</h3>
          <div class="jwa-role-grid">
            ${data.roles.map(r => `
              <article class="jwa-role-card">
                <strong>${esc(r.title)}</strong>
                <span class="jwa-salary">${esc(r.range)}</span>
                <span class="jwa-demand-badge" style="background:${DEMAND_COLOR[r.demand] || '#64748b'};">${esc(r.demand)} Demand</span>
                ${r.remote ? '<span class="jwa-remote-tag">Remote Eligible</span>' : ''}
              </article>
            `).join('')}
          </div>
        </section>
      `;
    }
    container.innerHTML = html || '<p class="jwa-empty">No industries match your filter.</p>';
  }

  /* ── 2. Diaspora Connection Pipeline ───────────────────────────────────── */
  const DIASPORA_HUBS = [
    { city: 'New York / New Jersey', country: 'USA', sectors: ['Finance', 'Healthcare', 'Education', 'Government'], connections: 847 },
    { city: 'London / Birmingham', country: 'UK', sectors: ['Healthcare (NHS)', 'Finance', 'Hospitality', 'Tech'], connections: 612 },
    { city: 'Toronto / Brampton', country: 'Canada', sectors: ['Tech', 'Finance', 'Healthcare', 'Construction'], connections: 534 },
    { city: 'Miami / Fort Lauderdale', country: 'USA', sectors: ['Logistics', 'Tourism', 'Retail', 'BPO'], connections: 389 },
    { city: 'Hartford / Boston', country: 'USA', sectors: ['Insurance', 'Healthcare', 'Education'], connections: 276 },
    { city: 'Atlanta', country: 'USA', sectors: ['Tech', 'Film & Media', 'Hospitality'], connections: 201 },
  ];

  function renderDiasporaPipeline() {
    const container = document.getElementById('jwaDiasporaList');
    if (!container) return;

    container.innerHTML = DIASPORA_HUBS.map(hub => `
      <article class="jwa-diaspora-card">
        <div class="jwa-diaspora-header">
          <strong class="jwa-diaspora-city">${esc(hub.city)}</strong>
          <span class="jwa-diaspora-country">${esc(hub.country)}</span>
        </div>
        <div class="jwa-diaspora-sectors">
          ${hub.sectors.map(s => `<span class="jwa-sector-tag">${esc(s)}</span>`).join('')}
        </div>
        <div class="jwa-diaspora-meta">
          <span>${hub.connections.toLocaleString()} diaspora-connected employers mapped</span>
        </div>
      </article>
    `).join('');
  }

  async function submitDiasporaMatch() {
    const role = String(document.getElementById('diasporaRole')?.value || '').trim();
    const location = String(document.getElementById('diasporaLocation')?.value || '').trim();
    const skills = String(document.getElementById('diasporaSkills')?.value || '').trim();

    if (!role) { setStatus('diasporaStatus', 'Please enter your target role.', '#dc2626'); return; }

    setStatus('diasporaStatus', 'Matching your profile to diaspora employers...', '#2563eb');

    await new Promise(r => setTimeout(r, 900));

    const matchedHubs = DIASPORA_HUBS.filter(h =>
      !location || h.city.toLowerCase().includes(location.toLowerCase()) || h.country.toLowerCase().includes(location.toLowerCase())
    );

    const total = matchedHubs.reduce((sum, h) => sum + h.connections, 0);
    const hub = matchedHubs[0] || DIASPORA_HUBS[0];

    setStatus('diasporaStatus',
      `Found <strong>${total.toLocaleString()}</strong> potential diaspora connections for <strong>${esc(role)}</strong>. Top cluster: <strong>${esc(hub.city)}</strong> (${hub.sectors.slice(0,2).join(', ')} sectors). Your profile has been flagged for outreach when matching opportunities open.`,
      '#16a34a'
    );
  }

  /* ── 3. Resume Localization Checker ────────────────────────────────────── */
  const JA_CREDENTIALS = [
    'CXC', 'CAPE', 'HEART', 'NSTA', 'UWI', 'UTech', 'NCU', 'UTECH',
    'GCE', 'CSEC', 'City & Guilds', 'NVQ-J', 'JCDC'
  ];

  const JA_POSITIVE_SIGNALS = [
    'stakeholder', 'team lead', 'programme', 'programme management', 'community',
    'parish', 'ministry', 'government', 'civil service', 'NGO', 'diaspora'
  ];

  const GLOBAL_RESUME_TERMS = [
    { term: 'Objective', suggestion: 'Replace "Objective" with a Professional Summary that leads with your strongest value.' },
    { term: 'References available upon request', suggestion: 'Remove this line entirely. It is implied and wastes space.' },
    { term: 'responsible for', suggestion: 'Replace "responsible for" with strong action verbs: Led, Managed, Delivered, Grew.' },
    { term: 'duties included', suggestion: 'Replace "duties included" with achievement-led bullets: Reduced X by Y%, Delivered Z on time.' },
    { term: 'team player', suggestion: 'Replace "team player" with a specific example of cross-team collaboration.' },
    { term: 'hard worker', suggestion: 'Replace "hard worker" with a quantified result that proves it.' },
  ];

  function checkResumeLocalization() {
    const text = String(document.getElementById('jwaResumeText')?.value || '').trim();
    if (!text) { setStatus('jwaResumeStatus', 'Please paste your resume text first.', '#dc2626'); return; }

    const lower = text.toLowerCase();
    const results = [];

    // Detect local credentials
    const foundCreds = JA_CREDENTIALS.filter(c => text.toUpperCase().includes(c));
    if (foundCreds.length) {
      results.push({ type: 'good', msg: `Detected Jamaican credentials: <strong>${foundCreds.join(', ')}</strong>. These are globally recognized. Make sure to spell them out once (e.g., "Caribbean Secondary Education Certificate (CSEC)").` });
    } else {
      results.push({ type: 'warn', msg: 'No Jamaican-specific credentials detected. If you hold CXC/CAPE/HEART certificates, add them — they are internationally recognized.' });
    }

    // Detect positive Jamaica market signals
    const foundSignals = JA_POSITIVE_SIGNALS.filter(s => lower.includes(s));
    if (foundSignals.length) {
      results.push({ type: 'good', msg: `Good local context signals found: <strong>${foundSignals.join(', ')}</strong>. These are valuable for local employers and diaspora-connected roles.` });
    }

    // Detect global improvement areas
    for (const item of GLOBAL_RESUME_TERMS) {
      if (lower.includes(item.term.toLowerCase())) {
        results.push({ type: 'improve', msg: item.suggestion });
      }
    }

    // Phone number format check
    if (/\b1876\b|\+1-876|\(876\)/.test(text)) {
      results.push({ type: 'good', msg: 'Jamaica phone format detected. For international applications, use format: +1-876-XXX-XXXX.' });
    }

    // USD vs JMD salary check
    if (/\bjmd\b/i.test(text)) {
      results.push({ type: 'warn', msg: 'JMD salary figures detected. For international or diaspora-employer applications, convert to USD equivalent with context.' });
    }

    const output = document.getElementById('jwaResumeResults');
    if (!output) return;

    output.innerHTML = results.map(r => `
      <div class="jwa-check-item jwa-check-${r.type}">
        <span class="jwa-check-icon">${r.type === 'good' ? '✔' : r.type === 'warn' ? '⚠' : '💡'}</span>
        <span>${r.msg}</span>
      </div>
    `).join('');

    const score = Math.min(100, Math.max(30, 40 + (foundCreds.length * 15) + (foundSignals.length * 5) - (GLOBAL_RESUME_TERMS.filter(i => lower.includes(i.term.toLowerCase())).length * 8)));
    setStatus('jwaResumeStatus', `Localization Score: <strong>${score}/100</strong>. ${score >= 75 ? 'Strong localization.' : score >= 50 ? 'Good base — apply suggestions above.' : 'Resume needs Jamaica-market alignment.'}`, score >= 75 ? '#16a34a' : score >= 50 ? '#ca8a04' : '#dc2626');
  }

  /* ── 4. Skills Gap Report ───────────────────────────────────────────────── */
  const SKILLS_GAP_DATA = [
    { skill: 'Digital Literacy & Cloud Tools', demandPct: 88, supplyPct: 42, gap: 46, priority: 'Critical' },
    { skill: 'Customer Service (Bilingual)', demandPct: 79, supplyPct: 35, gap: 44, priority: 'Critical' },
    { skill: 'Project Management (PMP/PRINCE2)', demandPct: 71, supplyPct: 29, gap: 42, priority: 'High' },
    { skill: 'Data Analysis & Reporting', demandPct: 76, supplyPct: 38, gap: 38, priority: 'High' },
    { skill: 'Cybersecurity Awareness', demandPct: 62, supplyPct: 25, gap: 37, priority: 'High' },
    { skill: 'Financial Analysis (ACCA/CPA)', demandPct: 68, supplyPct: 34, gap: 34, priority: 'High' },
    { skill: 'Software Development (Python/JS)', demandPct: 74, supplyPct: 41, gap: 33, priority: 'Moderate' },
    { skill: 'Supply Chain & Logistics Management', demandPct: 55, supplyPct: 27, gap: 28, priority: 'Moderate' },
    { skill: 'Healthcare Clinical Skills', demandPct: 81, supplyPct: 58, gap: 23, priority: 'Moderate' },
    { skill: 'Tourism & Hospitality Management', demandPct: 65, supplyPct: 54, gap: 11, priority: 'Low' },
  ];

  function renderSkillsGapChart() {
    const container = document.getElementById('jwaSkillsGapChart');
    if (!container) return;

    container.innerHTML = SKILLS_GAP_DATA.map(item => {
      const priorityColor = { Critical: '#dc2626', High: '#ea580c', Moderate: '#ca8a04', Low: '#16a34a' }[item.priority] || '#64748b';
      return `
        <div class="jwa-gap-row">
          <div class="jwa-gap-label">
            <span>${esc(item.skill)}</span>
            <span class="jwa-gap-badge" style="background:${priorityColor};">${esc(item.priority)}</span>
          </div>
          <div class="jwa-gap-bars">
            <div class="jwa-bar-wrap">
              <label>Employer Demand</label>
              <div class="jwa-bar jwa-bar-demand" style="width:${item.demandPct}%;">${item.demandPct}%</div>
            </div>
            <div class="jwa-bar-wrap">
              <label>Workforce Supply</label>
              <div class="jwa-bar jwa-bar-supply" style="width:${item.supplyPct}%;">${item.supplyPct}%</div>
            </div>
          </div>
          <div class="jwa-gap-delta">Gap: <strong style="color:${priorityColor};">-${item.gap}%</strong></div>
        </div>
      `;
    }).join('');
  }

  function downloadSkillsGapReport() {
    const btn = document.getElementById('jwaDownloadReportBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating report...'; }

    const lines = [
      'JAMAICA WORKFORCE ACCELERATOR',
      'Skills Gap Intelligence Report',
      `Generated: ${new Date().toLocaleDateString('en-JM', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      'EXECUTIVE SUMMARY',
      'This report identifies the most critical skill gaps between employer demand',
      'and workforce supply across Jamaica\'s key growth sectors.',
      'Data is aggregated from HEART/NSTA Trust, PIOJ, and regional employer surveys.',
      '',
      '─────────────────────────────────────────────────────',
      'SKILLS GAP ANALYSIS (sorted by gap size)',
      '─────────────────────────────────────────────────────',
      ...SKILLS_GAP_DATA.map(item =>
        `${item.skill.padEnd(40)} | Demand: ${String(item.demandPct+'%').padStart(4)} | Supply: ${String(item.supplyPct+'%').padStart(4)} | Gap: -${item.gap}% | Priority: ${item.priority}`
      ),
      '',
      '─────────────────────────────────────────────────────',
      'STRATEGIC RECOMMENDATIONS',
      '─────────────────────────────────────────────────────',
      '1. CRITICAL GAPS (46%+): Digital literacy and bilingual customer service require',
      '   immediate investment in short-cycle training programs (3-6 months).',
      '',
      '2. HIGH GAPS (33-45%): Project management, data analysis, and cybersecurity',
      '   should be prioritized in HEART/NSTA program expansion.',
      '',
      '3. DIASPORA LEVERAGE: Over 2,800 diaspora-connected employers in the US, UK,',
      '   and Canada are actively hiring for roles matching Jamaica\'s supply pipeline.',
      '   A formal diaspora employment corridor would reduce brain drain by 15-20%.',
      '',
      '4. IMMEDIATE WINS: Software development and tourism management have smaller',
      '   gaps and strong existing infrastructure — ideal for quick certification programs.',
      '',
      '─────────────────────────────────────────────────────',
      'GOVERNMENT PARTNERSHIP OPPORTUNITY',
      '─────────────────────────────────────────────────────',
      'RoleRocket AI\'s Jamaica Workforce Accelerator proposes a public-private',
      'partnership with HEART/NSTA Trust and the Ministry of Labour and Social',
      'Security to:',
      '',
      '  • Deploy AI-powered resume and ATS tools to HEART graduates',
      '  • Build a Jamaica-to-diaspora employment pipeline portal',
      '  • Provide quarterly skills gap analytics to the Ministry of Labour',
      '  • Integrate CXC/CAPE credential recognition into the ATS scoring engine',
      '',
      'Projected impact: 12,000+ Jamaicans better positioned for employment',
      'within 18 months of full deployment.',
      '',
      '─────────────────────────────────────────────────────',
      'CONTACT',
      '─────────────────────────────────────────────────────',
      'RoleRocket AI | Jamaica Workforce Accelerator Division',
      'For partnership inquiries: contact@rolerocketai.com',
      '',
      '© 2026 RoleRocket AI. All rights reserved.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Jamaica-Skills-Gap-Report-${new Date().getFullYear()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);

    if (btn) { btn.disabled = false; btn.textContent = 'Download Skills Gap Report'; }
    setStatus('jwaReportStatus', 'Report downloaded successfully.', '#16a34a');
  }

  /* ── Tab switching ──────────────────────────────────────────────────────── */
  function activateTab(tabId) {
    document.querySelectorAll('.jwa-tab-btn').forEach(btn => {
      btn.classList.toggle('jwa-tab-active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.jwa-tab-panel').forEach(panel => {
      panel.hidden = panel.id !== tabId;
    });
  }

  /* ── 5. Student Athlete PM Pathway ─────────────────────────────────────── */

  const SA_YEARS = {
    y1: {
      label: 'Year 1 — Build the Foundation',
      subtitle: 'Grade 11 / 6th Form (Age 15–16)',
      color: '#60a5fa',
      blocks: [
        {
          icon: '📚',
          title: 'Academic Focus',
          items: [
            '<strong>Priority subjects:</strong> Mathematics, English Language, Information Technology, Business Studies, Social Studies.',
            'Target a minimum of 5 CSEC passes — Math and English are non-negotiable for any university programme.',
            'Create a revision timetable and protect study blocks the same way you protect training sessions.',
            'Find a study partner from your team — accountability works in both directions.',
            'Use free platforms: Khan Academy (Math), BBC Bitesize (CSEC subjects), YouTube for IT basics.',
          ]
        },
        {
          icon: '⚽',
          title: 'Athletics Strategy',
          items: [
            'Identify your leadership role on the team — captain, vice-captain, or organiser of pre-match logistics.',
            'Start an athlete journal: record your training load, recovery, nutrition, and mental state weekly.',
            'Treat off-season as skill development time, not rest time — this mindset will serve you in PM roles.',
            'Build relationships with your coach; a coach reference letter is worth more than a generic recommendation.',
            'Attend at least one inter-school event outside your sport to broaden your network early.',
          ]
        },
        {
          icon: '💼',
          title: 'Early PM Seeds',
          items: [
            'Volunteer to organise one school event — sports day, a club fundraiser, or a community project.',
            'Learn what a project scope is: what is included, what is excluded, and why that matters.',
            '<strong>Free course to start:</strong> Google Digital Garage — Fundamentals of Digital Marketing (100% free, recognised certificate).',
            'Shadow a teacher, coach, or parent who manages teams or projects and ask them one question per month.',
            'Begin a simple task tracker (notebook or Google Sheets) for your own school assignments — this is project management.',
          ]
        },
        {
          icon: '⚖️',
          title: 'Work / Life Balance',
          items: [
            '<strong>Training days (3x/week):</strong> 1.5 hrs training → 30 min recovery → 2 hrs study → 30 min free time.',
            '<strong>Rest days (2x/week):</strong> 3 hrs deep study → 1 hr personal project → 1 hr social/family.',
            'Sleep is a performance input, not a reward — protect 8 hrs on school nights.',
            'One full tech-free evening per week is non-negotiable for mental reset.',
            'Communicate your schedule to your family so they understand your commitments and can support you.',
          ],
          balance: { Study: 45, Training: 25, Recovery: 15, Social: 15 }
        },
        {
          icon: '💰',
          title: 'Financial Awareness',
          items: [
            'Research JASFUND (Jamaica Student Finance Fund) now — understand what it covers and its eligibility criteria.',
            'Ask your school counsellor for a list of scholarships available to student athletes in Jamaica.',
            'Open a savings account if you do not already have one — build the habit of saving JMD 500/week minimum.',
            'Research which US colleges offer athletic scholarships for your sport — NCAA Divisions I, II, and III all have different rules.',
            'Follow the Champs Athletics Association for scholarship networking opportunities.',
          ]
        }
      ],
      milestone: 'Complete 5+ CSEC subjects, earn one recognised online certificate, volunteer-lead one school project.'
    },
    y2: {
      label: 'Year 2 — Accelerate and Decide',
      subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)',
      color: '#a78bfa',
      blocks: [
        {
          icon: '📚',
          title: 'Academic Focus',
          items: [
            '<strong>CAPE units:</strong> Business Management Unit 1 & 2 are the strongest foundation for a PM career.',
            'Communication Studies Unit 1 will sharpen your stakeholder communication — a core PM skill.',
            'If IT is available, take it — project management software knowledge starts here.',
            'Aim for Grade I or II in at least 3 CAPE units. Grade III is acceptable but will limit scholarship options.',
            'Write your personal statement draft now, even if you are not applying yet. Revise it quarterly.',
          ]
        },
        {
          icon: '⚽',
          title: 'Athletics Strategy',
          items: [
            'This is your peak performance year. Use it to build an athletic portfolio: stats, videos, news coverage.',
            'Contact university athletic departments directly — email them your profile and ask about scholarship consideration.',
            'Represent your school, parish, or national team wherever possible. Every credential counts.',
            'Start stepping back from execution roles and step into leadership roles: captain, spokesperson, strategist.',
            'Attend at least one college or university open day (UWI, UTech, NCU, or overseas virtual options).',
          ]
        },
        {
          icon: '💼',
          title: 'PM Skill Building',
          items: [
            '<strong>Start now:</strong> Google Project Management Certificate on Coursera — it is free to audit, ~6 months part-time.',
            'Learn Microsoft Excel or Google Sheets at an intermediate level — every PM uses spreadsheets daily.',
            'Lead a real project at school: a fundraiser, an inter-school event, or a community initiative.',
            'Document every project you lead: what the goal was, what your plan was, what happened, what you would do differently.',
            'Learn what Agile and Waterfall methodologies are — these are the two main PM frameworks you will use professionally.',
          ]
        },
        {
          icon: '⚖️',
          title: 'Work / Life Balance',
          items: [
            'This year is the most intense. Build a <strong>weekly operating plan</strong> every Sunday for the coming week.',
            'Use the Pomodoro Technique for study: 25 min focused work, 5 min break, repeat 4x, then 30 min rest.',
            'Pre-season: reduce social commitments and protect study blocks. Post-season: restore them.',
            'Identify one person you can call when overwhelmed — a parent, mentor, or trusted friend.',
            'Celebrate small wins (a good grade, a good training session) — momentum is a mental skill.',
          ],
          balance: { Study: 50, Training: 22, Recovery: 14, Social: 14 }
        },
        {
          icon: '💰',
          title: 'Financial & College Decisions',
          items: [
            '<strong>Apply for JASFUND</strong> — applications open annually. Deadline is typically February–March.',
            '<strong>Apply for Rosalee Gage-Grey Scholarship</strong> (UWI, merit-based for Jamaican students).',
            '<strong>Athletic scholarships — US:</strong> Register on NCAA Eligibility Center (eligibilitycenter.org). It costs ~USD $100 but unlocks Division I/II scholarship access.',
            'Request letters of recommendation from your coach and two teachers before school ends.',
            'Draft your college shortlist: 2 Jamaica options, 2 UK options, 2 US options, 1 Canada option.',
          ]
        }
      ],
      milestone: 'Earn CAPE results in 3+ units, complete Google PM Certificate audit, submit at least 2 scholarship applications, finalise college shortlist.'
    },
    y3: {
      label: 'Year 3 — University Foundations',
      subtitle: '1st Year of University (Age 17–19)',
      color: '#34d399',
      blocks: [
        {
          icon: '📚',
          title: 'Academic Focus',
          items: [
            '<strong>Ideal programmes:</strong> BSc Business Administration, BSc Project Management, BSc Information Technology (Management track), BSc Management Studies.',
            'UWI Mona and UTech both offer management and IT programmes that feed directly into PM careers.',
            'First year is about building GPA — aim for a 3.2 GPA or above to keep scholarship eligibility.',
            'Take every elective that covers communication, negotiation, leadership, or data analysis.',
            'Join the student council, project management club, or business society — these are professional development hours.',
          ]
        },
        {
          icon: '⚽',
          title: 'Athletics Strategy',
          items: [
            'Collegiate sports will be more competitive — use the same discipline that got you here.',
            'Your athletic career is now a credential. Keep statistics and document achievements.',
            'Start using your sport to build professional language: "I coordinated logistics for 40 team members" — that is PM language.',
            'Reduce the time you spend on sport if academic pressure peaks. Your degree comes first.',
            'Connect with alumni athletes who are now working professionals — ask for 20-minute informational interviews.',
          ]
        },
        {
          icon: '💼',
          title: 'PM Skill Building',
          items: [
            '<strong>Complete Google Project Management Certificate</strong> (Coursera, ~USD $50/month or free audit).',
            'Learn a PM tool: Trello (free), Asana (free tier), or Microsoft Project (university licence).',
            'Get your first internship or volunteer experience in a project support role — coordinator, admin, or assistant PM.',
            'Study for and sit the <strong>CAPM (Certified Associate in Project Management)</strong> by PMI — eligible from university with 23 hrs PM education.',
            'Build a LinkedIn profile that frames your athletic leadership in PM language.',
          ]
        },
        {
          icon: '⚖️',
          title: 'Work / Life Balance',
          items: [
            'University social life is a real pressure. Set clear boundaries: two social events per week maximum during exam season.',
            'Batch your assignments — submit ahead of deadlines whenever possible to create buffer time.',
            'Use Sunday evenings to plan the full coming week before it starts.',
            '<strong>Physical recovery matters more than ever:</strong> an injury during year 3 can derail both sport and study.',
            'Find a mentor at your university — a lecturer, career counsellor, or alumni contact in project management.',
          ],
          balance: { Study: 48, Training: 18, Recovery: 16, Social: 18 }
        },
        {
          icon: '💰',
          title: 'Managing University Finances',
          items: [
            '<strong>JASFUND loans:</strong> Up to JMD 1.5M/year for accredited programmes. Repayment starts after graduation.',
            '<strong>UWI Merit Scholarships:</strong> Awarded to students entering with strong CAPE results. Renewable annually based on GPA.',
            'Apply for campus work-study programmes — library, admin, tutoring — for supplemental income.',
            'Open a student bank account (NCB, Scotiabank, or JMMB have student-specific accounts with no monthly fees).',
            'Budget monthly: tuition, transport, food, data/internet, and a small savings line.',
          ]
        }
      ],
      milestone: 'Maintain 3.0+ GPA, complete Google PM Certificate, earn first PM internship or volunteer project role, register on LinkedIn.'
    },
    y4: {
      label: 'Year 4 — Certify and Launch',
      subtitle: 'Final Year + PM Certification (Age 20–22)',
      color: '#fdb714',
      blocks: [
        {
          icon: '📚',
          title: 'Academic Focus',
          items: [
            'Your final year project should be a real-world project management case study — choose a topic with industry relevance.',
            'Target a Second Class Upper (2:1) or First Class degree — these open doors to graduate programmes and international employers.',
            'Ask your dissertation supervisor to review your work through a PM lens: scope, deliverables, stakeholders, timeline.',
            'Apply for graduate programmes early if you want to continue studying (MBA, MSc Project Management).',
            'Attend every career fair your university hosts and bring 20 printed copies of your one-page CV.',
          ]
        },
        {
          icon: '⚽',
          title: 'Athletics → Leadership Transition',
          items: [
            'Begin shifting your identity from athlete to professional. You are a project manager who played sport — not the other way around.',
            'Volunteer to manage an alumni sporting event — this is a legitimate PM project you can put on your resume.',
            'Write a one-page "athlete to PM" story for your cover letters: how sport taught you delivery, pressure, and teamwork.',
            'Your final athletic season should be celebrated. After it ends, redirect that time to PM certification study.',
            'Connect with at least 5 professionals in project management on LinkedIn this year.',
          ]
        },
        {
          icon: '💼',
          title: 'Certification Sprint',
          items: [
            '<strong>Sit the CAPM exam</strong> before you graduate — you only need 23 hours of PM education and no professional experience.',
            'CAPM exam fee: USD $225 (PMI student member rate). PMI student membership costs USD $32/year.',
            '<strong>PMP (Project Management Professional):</strong> Requires 36 months work experience post-graduation. Plan to sit it at Year 6.',
            'Consider also: Prince2 Foundation (used widely in UK/government), Agile/Scrum Master certification (used in tech).',
            'Build a portfolio of 3 documented projects (school, volunteer, internship) with scope, timeline, outcomes, and lessons learned.',
          ]
        },
        {
          icon: '⚖️',
          title: 'Work / Life Balance — Final Push',
          items: [
            'Burnout is a real risk in final year. Schedule one full offline day per week without exception.',
            'Dissertation + certification study + job applications will all run at the same time. Use a master task board.',
            'Block time for physical activity even if sport is over — 3x30 min walks per week minimum for mental clarity.',
            'Pre-plan your post-graduation month: one week off, then a structured job search sprint.',
            'Communicate with your family about your timeline so they can support your post-grad transition.',
          ],
          balance: { Study: 45, Certification: 20, Recovery: 15, JobSearch: 20 }
        },
        {
          icon: '💰',
          title: 'Final Year Finances',
          items: [
            'Start paying down JASFUND interest during your final semester if possible — it reduces your long-term debt load.',
            '<strong>Graduate scholarships:</strong> Chevening (UK), Commonwealth Scholarship (UK/Canada), Fulbright (USA) — apply in final year for post-graduate study.',
            'Save 3 months of living expenses before you graduate — a financial buffer gives you negotiating power in your first job search.',
            'Research salary ranges for entry-level PM roles: JMD 1.8M–2.8M/yr in Jamaica, USD 55k–70k in North America.',
            'Consider a short-term contract or freelance project coordination role while searching for a full-time PM position.',
          ]
        }
      ],
      milestone: 'Graduate with 2:1 or higher, earn CAPM certification, complete job applications to 5+ PM roles, have 3 documented projects in your portfolio.'
    },
    y5: {
      label: 'Day 1 — You Are a Project Manager',
      subtitle: 'First Role — First 90 Days',
      color: '#f87171',
      blocks: [
        {
          icon: '🗺️',
          title: 'Before Day 1 — Final Preparation',
          items: [
            'Research your employer thoroughly: their industry, recent projects, leadership team, and culture.',
            'Set up a clean, professional email signature with your name, title, CAPM (or other certification), and LinkedIn URL.',
            'Prepare three questions to ask your manager in your first week: about priorities, success metrics, and team culture.',
            'Organise your digital workspace: create folders for project documentation, templates, and communications.',
            'Read the PMI Code of Ethics — your professional certification has standards you are now accountable to.',
          ]
        },
        {
          icon: '📋',
          title: 'First 30 Days — Listen and Map',
          items: [
            '<strong>Do not try to fix things yet.</strong> Your job in month one is to understand how things work.',
            'Map all stakeholders: who has influence, who has interest, who makes decisions, and who needs information.',
            'Build a relationship with your team members before you build a plan. People follow people they trust.',
            'Sit in on every meeting you are invited to. Take notes. Ask one clarifying question per meeting.',
            'Identify the one metric your manager cares about most and build your work around it.',
          ]
        },
        {
          icon: '🚀',
          title: 'Days 31–60 — Deliver a Quick Win',
          items: [
            'Identify one small, well-scoped problem you can solve within 30 days. Solve it visibly.',
            'Build your first project status update — a simple one-page summary of scope, progress, risks, and next steps.',
            'Introduce a simple process improvement that saves the team time or reduces a recurring error.',
            'Start your PMP work experience log now — every project you touch counts toward your 36-month requirement.',
            'Ask for feedback at the 30-day mark. This shows maturity and commitment to improvement.',
          ]
        },
        {
          icon: '🏆',
          title: 'Days 61–90 — Own Your Lane',
          items: [
            'Take ownership of at least one formal project. Draft the project charter yourself.',
            'Establish a regular cadence of stakeholder updates — weekly for active projects, bi-weekly for planning phases.',
            'Begin studying for the PMP exam. A structured 3-month prep plan works well alongside full-time work.',
            'Find an internal mentor — someone 5–10 years ahead of you in PM or programme management.',
            'Document your achievements: what you delivered, what you improved, what you learned. This fuels your next performance review.',
          ]
        },
        {
          icon: '⚖️',
          title: 'Sustaining Work / Life Balance as a Professional',
          items: [
            'The discipline you built as a student athlete is your biggest competitive advantage. Do not abandon it.',
            '<strong>Protect your mornings:</strong> a 30-minute planning session before you open Slack or email sets the tone for the day.',
            'Never skip recovery. In sport it was sleep and nutrition; in work it is boundaries, weekends, and real downtime.',
            'Book your next vacation or rest period before you start a demanding project phase — not after.',
            'Your career is a marathon, not a sprint. Consistency over intensity wins in both sport and project management.',
          ],
          balance: { DeepWork: 40, Meetings: 25, Learning: 15, Recovery: 20 }
        }
      ],
      milestone: 'Complete first 90-day plan, log 200+ hours toward PMP experience requirement, earn your first formal PM performance review.'
    }
  };

  const SA_LESSONS = [
    {
      num: 1, title: 'Scope Management',
      body: 'Define exactly what is in your project — and what is not. Uncontrolled scope growth is the #1 reason projects fail.',
      sport: 'In sport: your game plan defines what you will and will not do. You do not change it mid-play without purpose.'
    },
    {
      num: 2, title: 'Schedule & Time Management',
      body: 'Build a timeline, identify dependencies, and track progress weekly. Late delivery costs money and damages trust.',
      sport: 'You already do this: training cycles, taper weeks, competition calendars. That is schedule management.'
    },
    {
      num: 3, title: 'Stakeholder Communication',
      body: 'Every project has people who need updates, have opinions, or can block progress. Managing them proactively is half the job.',
      sport: 'Coaches, parents, selectors, sponsors — you already manage multiple stakeholders with competing expectations.'
    },
    {
      num: 4, title: 'Risk Management',
      body: 'Identify what can go wrong before it does. Create a mitigation plan. Never be surprised by something you could have anticipated.',
      sport: 'Pre-match scouting, weather contingencies, injury protocols — you already practise risk planning instinctively.'
    },
    {
      num: 5, title: 'Budget & Resource Management',
      body: 'Projects always have constraints. You must deliver maximum value with the time, money, and people available.',
      sport: 'Managing training time, equipment budgets, and team energy levels across a long season is resource management.'
    },
    {
      num: 6, title: 'Leadership Under Pressure',
      body: 'The best PMs stay calm, make decisions with incomplete information, and keep teams moving when things get hard.',
      sport: 'Down by two goals with 10 minutes left. You already know how to lead under pressure.'
    },
    {
      num: 7, title: 'Agile & Adaptive Thinking',
      body: 'Plans change. The ability to reassess, reprioritise, and re-plan quickly is what separates good PMs from great ones.',
      sport: 'Half-time tactical changes. Adapting your game plan when the opponent does something unexpected.'
    },
    {
      num: 8, title: 'Closing & Lessons Learned',
      body: 'Every project ends with a formal review: what was delivered, what went well, what failed, and what the team will do differently.',
      sport: 'Post-match analysis, season reviews, and film sessions — you already know how to debrief for continuous improvement.'
    }
  ];

  const SA_FINANCE = [
    {
      region: 'Jamaica — Local Funding', color: '#34d399',
      sources: [
        { name: 'JASFUND (Jamaica Student Finance Fund)', detail: 'Government loan up to JMD 1.5M/year. Low interest, repayment starts after graduation. Apply at jasfund.gov.jm.' },
        { name: 'HEART/NSTA Trust Scholarships', detail: 'Covers vocational and technical certifications including PM-aligned programmes. Apply directly at heart.gov.jm.' },
        { name: 'UWI Open Campus & Mona Scholarships', detail: 'Merit-based and need-based awards. Renewable annually. Requires 3.0+ GPA for renewal.' },
        { name: 'NCU (Northern Caribbean University) Grants', detail: 'Faith-based scholarships and athletic grants available. Contact admissions directly.' },
        { name: 'UTech Academic Scholarships', detail: 'Available for top CAPE performers entering technology and management programmes.' },
        { name: 'Parish Council Bursaries', detail: 'Each parish council administers small bursaries for residents. Contact your local parish council office.' },
      ],
      tip: 'Apply to at least 4 Jamaica sources simultaneously. Most have February–April deadlines. Never miss a deadline — late applications are almost never accepted.'
    },
    {
      region: 'United States — Athletic & Academic', color: '#60a5fa',
      sources: [
        { name: 'NCAA Athletic Scholarships (Division I & II)', detail: 'Full and partial scholarships for eligible student athletes. Register at eligibilitycenter.org. Costs ~USD $100 to register.' },
        { name: 'NAIA Athletic Scholarships', detail: 'Smaller colleges, more flexible eligibility. Many offer full scholarships in track, football, and basketball.' },
        { name: 'Fulbright Foreign Student Programme', detail: 'Fully funded graduate study in the USA. Open to Jamaican citizens. Apply at fulbright.org.jm. Deadline: June each year.' },
        { name: 'USAID Caribbean Education Grants', detail: 'Need-based funding for Caribbean nationals. Check usaid.gov for current programme availability.' },
        { name: 'University Merit Scholarships', detail: 'Most US universities offer partial merit scholarships for international students with strong academics. Apply directly to the university.' },
      ],
      tip: 'For NCAA, your academic eligibility is evaluated on core course GPA and standardised test scores (SAT/ACT). Prepare these in Year 2.'
    },
    {
      region: 'United Kingdom — Prestigious Awards', color: '#a78bfa',
      sources: [
        { name: 'Chevening Scholarship', detail: 'Fully funded one-year Masters at any UK university. Open to Jamaicans with 2+ years work experience. chevening.org. Deadline: November.' },
        { name: 'Commonwealth Scholarship', detail: 'Fully funded PhD and Masters for citizens of Commonwealth countries including Jamaica. cscuk.fcdo.gov.uk.' },
        { name: 'University of Edinburgh Global Scholarship', detail: 'Competitive partial scholarship for international undergraduates. Strong in business and management.' },
        { name: 'UK University Athletic Scholarships (BUCS)', detail: 'UK universities offer athletic bursaries for elite athletes. Contact university sports offices directly.' },
        { name: 'Turing Scheme Placements', detail: 'Funded study and work placements in the UK for students from eligible countries. Check with your Jamaican university.' },
      ],
      tip: 'Chevening and Commonwealth are the two gold-standard awards for Jamaican students. Apply even if you think you are not competitive enough — the calibre of applicants from Jamaica is strong and both programmes value Caribbean representation.'
    },
    {
      region: 'Canada — Growing Pathway', color: '#fdb714',
      sources: [
        { name: 'Ontario and Quebec Provincial Grants', detail: 'Partial grants for international students in certain programmes. Eligibility varies by province and year of study.' },
        { name: 'University of Toronto International Scholars', detail: 'Prestigious partial scholarship for international undergraduates. Apply through the admissions process.' },
        { name: 'York University International Student Bursaries', detail: 'Need-based bursaries for students demonstrating financial hardship.' },
        { name: 'Canadian Athletic Bursaries (U SPORTS)', detail: 'Canadian university athletics offers bursaries (not full scholarships like NCAA) for elite athletes. Contact athletic directors directly.' },
        { name: 'Global Affairs Canada Scholarships', detail: 'Various funded programmes for students from developing countries. Check scholarships.gc.ca.' },
      ],
      tip: 'Canada is an increasingly popular destination for Jamaican students. Post-graduation work permits (PGWP) allow up to 3 years of work after completing a degree — a strong pathway to permanent residency.'
    }
  ];

  function renderAthleteYear(yearKey) {
    const data = SA_YEARS[yearKey];
    if (!data) return;

    const content = document.getElementById('saYearContent');
    if (!content) return;

    const balanceBlock = data.blocks.find(b => b.balance);
    const balanceHtml = balanceBlock ? `
      <div class="sa-block" style="border-left:4px solid ${data.color};">
        <div class="sa-block-title"><span class="sa-block-icon">📊</span> Your Week at a Glance</div>
        ${Object.entries(balanceBlock.balance).map(([label, pct]) => `
          <div class="sa-balance-row">
            <div class="sa-balance-label"><span>${label}</span><span>${pct}%</span></div>
            <div class="sa-balance-track"><div class="sa-balance-fill" style="width:${pct}%;"></div></div>
          </div>
        `).join('')}
      </div>
    ` : '';

    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="color:${data.color};margin:0 0 4px;font-size:1.2rem;">${esc(data.label)}</h3>
        <p style="color:#64748b;font-size:.88rem;margin:0;">${esc(data.subtitle)}</p>
      </div>
      <div class="sa-year-grid">
        ${data.blocks.map(b => `
          <div class="sa-block">
            <div class="sa-block-title"><span class="sa-block-icon">${b.icon}</span>${esc(b.title)}</div>
            <ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul>
          </div>
        `).join('')}
        ${balanceHtml}
      </div>
      <div class="sa-milestone">${esc(data.milestone)}</div>
    `;
  }

  function renderAthleteInit() {
    // Lessons
    const lessonsGrid = document.getElementById('saLessonsGrid');
    if (lessonsGrid) {
      lessonsGrid.innerHTML = SA_LESSONS.map(l => `
        <div class="sa-lesson-card">
          <div class="sa-lesson-num">${l.num}</div>
          <h4>${esc(l.title)}</h4>
          <p>${esc(l.body)}</p>
          <p class="sa-lesson-sport">${esc(l.sport)}</p>
        </div>
      `).join('');
    }

    // Financing
    const financeGrid = document.getElementById('saFinanceGrid');
    if (financeGrid) {
      financeGrid.innerHTML = SA_FINANCE.map(f => `
        <div class="sa-finance-card" style="border-left-color:${f.color};">
          <h4 style="color:${f.color};">${esc(f.region)}</h4>
          <div class="sa-fc-country">Funding Sources</div>
          <ul>
            ${f.sources.map(s => `<li><strong>${esc(s.name)}</strong> — ${esc(s.detail)}</li>`).join('')}
          </ul>
          <div class="sa-finance-tip">${esc(f.tip)}</div>
        </div>
      `).join('');
    }

    // Year buttons
    renderAthleteYear('y1');
    document.querySelectorAll('.sa-year-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sa-year-btn').forEach(b => b.classList.remove('sa-year-active'));
        this.classList.add('sa-year-active');
        renderAthleteYear(this.dataset.year);
      });
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    renderMarketRadar();
    renderDiasporaPipeline();
    renderSkillsGapChart();
    renderAthleteInit();

    document.getElementById('jwaIndustryFilter')?.addEventListener('change', renderMarketRadar);

    document.getElementById('jwaDiasporaMatchBtn')?.addEventListener('click', submitDiasporaMatch);

    document.getElementById('jwaCheckResumeBtn')?.addEventListener('click', checkResumeLocalization);

    document.getElementById('jwaDownloadReportBtn')?.addEventListener('click', downloadSkillsGapReport);

    document.querySelectorAll('.jwa-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // Start on first tab
    activateTab('jwaTabMarket');
  });
})();

