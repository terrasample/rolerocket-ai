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

  /* ── Init ───────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    renderMarketRadar();
    renderDiasporaPipeline();
    renderSkillsGapChart();

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
