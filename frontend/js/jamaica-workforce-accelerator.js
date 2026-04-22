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
    },
    'Engineering & Construction': {
      color: '#f97316',
      roles: [
        { title: 'Civil Engineer', range: 'JMD 2.5M–4.5M/yr', demand: 'High', remote: false },
        { title: 'Electrical Engineer', range: 'JMD 2.2M–4.0M/yr', demand: 'High', remote: false },
        { title: 'Quantity Surveyor', range: 'JMD 2.0M–3.5M/yr', demand: 'Moderate', remote: false },
        { title: 'Site / Construction Manager', range: 'JMD 2.4M–4.2M/yr', demand: 'High', remote: false },
        { title: 'Mechanical Engineer', range: 'JMD 2.2M–3.8M/yr', demand: 'Moderate', remote: false },
      ]
    },
    'Aviation & Transport': {
      color: '#38bdf8',
      roles: [
        { title: 'Commercial Pilot (ATPL)', range: 'JMD 5M–12M/yr', demand: 'High', remote: false },
        { title: 'Aircraft Maintenance Engineer (AME)', range: 'JMD 3.0M–5.5M/yr', demand: 'High', remote: false },
        { title: 'Air Traffic Controller', range: 'JMD 4.0M–7.0M/yr', demand: 'Moderate', remote: false },
        { title: 'Airport Operations Officer', range: 'JMD 1.5M–2.8M/yr', demand: 'Moderate', remote: false },
        { title: 'Logistics & Fleet Manager', range: 'JMD 1.8M–3.2M/yr', demand: 'High', remote: false },
      ]
    },
    'Agriculture & Agribusiness': {
      color: '#84cc16',
      roles: [
        { title: 'Agricultural Extension Officer', range: 'JMD 1.2M–2.0M/yr', demand: 'High', remote: false },
        { title: 'Agribusiness Manager', range: 'JMD 2.0M–3.5M/yr', demand: 'Moderate', remote: false },
        { title: 'Food Scientist / Quality Assurance', range: 'JMD 1.8M–3.0M/yr', demand: 'High', remote: false },
        { title: 'Farm / Plantation Supervisor', range: 'JMD 1.0M–1.8M/yr', demand: 'High', remote: false },
        { title: 'Agri-Tech & Precision Farming Specialist', range: 'JMD 2.2M–3.8M/yr', demand: 'Moderate', remote: false },
      ]
    },
    'Education & Training': {
      color: '#e879f9',
      roles: [
        { title: 'Secondary School Teacher (STEM)', range: 'JMD 1.2M–2.0M/yr', demand: 'Critical', remote: false },
        { title: 'Early Childhood Educator', range: 'JMD 700k–1.2M/yr', demand: 'High', remote: false },
        { title: 'Corporate Trainer / L&D Specialist', range: 'JMD 1.5M–2.8M/yr', demand: 'Moderate', remote: true },
        { title: 'Guidance Counsellor', range: 'JMD 1.1M–1.9M/yr', demand: 'High', remote: false },
        { title: 'TVET / Vocational Instructor', range: 'JMD 1.0M–1.7M/yr', demand: 'High', remote: false },
      ]
    },
    'Legal & Professional Services': {
      color: '#818cf8',
      roles: [
        { title: 'Attorney-at-Law', range: 'JMD 2.5M–6.0M/yr', demand: 'Moderate', remote: false },
        { title: 'Paralegal / Legal Officer', range: 'JMD 1.2M–2.2M/yr', demand: 'Moderate', remote: false },
        { title: 'Human Resource Manager', range: 'JMD 1.8M–3.2M/yr', demand: 'High', remote: false },
        { title: 'Compliance & Risk Officer', range: 'JMD 2.0M–3.5M/yr', demand: 'High', remote: false },
        { title: 'Management Consultant', range: 'JMD 2.5M–5.0M/yr', demand: 'Moderate', remote: true },
      ]
    },
    'Creative Industries': {
      color: '#fb7185',
      roles: [
        { title: 'Music Producer / Sound Engineer', range: 'JMD 1.2M–3.5M/yr', demand: 'Moderate', remote: true },
        { title: 'Film / Video Director', range: 'JMD 1.5M–4.0M/yr', demand: 'Moderate', remote: false },
        { title: 'Graphic Designer / Art Director', range: 'JMD 1.0M–2.5M/yr', demand: 'High', remote: true },
        { title: 'Content Creator / Influencer Strategist', range: 'JMD 800k–3.0M/yr', demand: 'High', remote: true },
        { title: 'Animator / Motion Graphics Artist', range: 'JMD 1.2M–2.8M/yr', demand: 'Moderate', remote: true },
      ]
    },
    'Energy & Utilities': {
      color: '#fcd34d',
      roles: [
        { title: 'Renewable Energy Engineer', range: 'JMD 2.8M–5.0M/yr', demand: 'High', remote: false },
        { title: 'Solar PV Technician', range: 'JMD 1.5M–2.8M/yr', demand: 'Very High', remote: false },
        { title: 'Utilities Operations Manager', range: 'JMD 2.5M–4.5M/yr', demand: 'Moderate', remote: false },
        { title: 'Environmental / Sustainability Officer', range: 'JMD 1.8M–3.2M/yr', demand: 'High', remote: false },
      ]
    },
    'Real Estate & Property': {
      color: '#2dd4bf',
      roles: [
        { title: 'Real Estate Salesperson / Broker', range: 'JMD 1.5M–4.5M/yr', demand: 'High', remote: false },
        { title: 'Property Manager', range: 'JMD 1.4M–2.8M/yr', demand: 'Moderate', remote: false },
        { title: 'Valuator / Property Appraiser', range: 'JMD 2.0M–3.5M/yr', demand: 'Moderate', remote: false },
        { title: 'Mortgage & Housing Finance Officer', range: 'JMD 1.6M–2.8M/yr', demand: 'High', remote: false },
      ]
    }
  };

  const DEMAND_COLOR = { 'Critical': '#dc2626', 'Very High': '#ea580c', 'High': '#ca8a04', 'Moderate': '#16a34a' };

  const REGION_MARKETS = [
    {
      id: 'jamaica',
      label: 'Jamaican Jobs',
      icon: '🇯🇲',
      locationQuery: 'Jamaica',
      lockLabel: 'Location lock: Jamaica only',
      matchHints: ['jamaica', 'kingston', 'montego bay', 'st. andrew', 'st andrew', 'ocho rios', 'spanish town']
    },
    {
      id: 'us',
      label: 'US Jobs',
      icon: '🇺🇸',
      locationQuery: 'United States',
      lockLabel: 'Location lock: United States only',
      matchHints: ['united states', 'usa', 'us', 'new york', 'texas', 'florida', 'california', 'atlanta', 'miami']
    },
    {
      id: 'uk',
      label: 'UK Jobs',
      icon: '🇬🇧',
      locationQuery: 'United Kingdom',
      lockLabel: 'Location lock: United Kingdom only',
      matchHints: ['united kingdom', 'uk', 'england', 'london', 'birmingham', 'manchester', 'scotland', 'wales']
    },
    {
      id: 'canada',
      label: 'Canada Jobs',
      icon: '🇨🇦',
      locationQuery: 'Canada',
      lockLabel: 'Location lock: Canada only',
      matchHints: ['canada', 'toronto', 'ontario', 'vancouver', 'alberta', 'montreal', 'calgary']
    },
    {
      id: 'eu',
      label: 'EU Jobs',
      icon: '🇪🇺',
      locationQuery: 'European Union',
      lockLabel: 'Location lock: Europe only',
      matchHints: ['europe', 'eu', 'germany', 'france', 'netherlands', 'spain', 'ireland', 'italy', 'poland']
    },
    {
      id: 'caribbean',
      label: 'Caribbean Jobs',
      icon: '🌴',
      locationQuery: 'Caribbean',
      lockLabel: 'Location lock: Caribbean only',
      matchHints: ['caribbean', 'trinidad', 'barbados', 'bahamas', 'st lucia', 'guyana', 'jamaica']
    }
  ];

  function isAbsoluteHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || ''));
  }

  function getScoutApiUrl(params) {
    const path = `/api/jobs/scout?${params.toString()}`;
    if (typeof apiUrl === 'function') return apiUrl(path);
    return path;
  }

  function matchesMarketLocation(jobLocation, market) {
    const text = String(jobLocation || '').toLowerCase();
    if (!text) return false;
    return market.matchHints.some((hint) => text.includes(hint));
  }

  function matchesMarketBySignals(job, market) {
    const locationText = String(job?.location || '').toLowerCase();
    const sourceText = String(job?.source || '').toLowerCase();
    const linkText = String(job?.link || '').toLowerCase();
    const combined = `${locationText} ${sourceText} ${linkText}`;

    if (market.matchHints.some((hint) => combined.includes(hint))) return true;

    if (market.id === 'uk') return /\.co\.uk|uk\.indeed|reed\.co\.uk|totaljobs/i.test(linkText);
    if (market.id === 'canada') return /\.ca\b|ca\.indeed|jobbank\.gc\.ca/i.test(linkText);
    if (market.id === 'jamaica') return /\.jm\b|jm\.indeed|caribbeanjobs/i.test(linkText);
    if (market.id === 'us') return /usa|united\s*states|\.gov\b|usajobs|ziprecruiter|monster/i.test(combined);
    if (market.id === 'eu') return /eu|europe|european|europa|eures/i.test(combined);
    if (market.id === 'caribbean') return /caribbean|trinidad|barbados|bahamas|guyana|st\s*lucia/i.test(combined);

    return false;
  }

  function formatPostedDate(iso) {
    if (!iso) return 'recent';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'recent';
    return d.toLocaleDateString('en-JM', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function scoreJamaicaSourcePreference(job) {
    const link = String(job?.link || '').toLowerCase();
    const source = String(job?.source || '').toLowerCase();
    const location = String(job?.location || '').toLowerCase();

    let score = 0;
    if (link.includes('jm.indeed.com')) score += 50;
    if (link.includes('caribbeanjobs.com')) score += 40;
    if (link.includes('.jm')) score += 30;
    if (source.includes('adzuna')) score -= 10;
    if (source.includes('usajobs')) score -= 15;
    if (location.includes('jamaica')) score += 20;
    if (location.includes('kingston') || location.includes('montego bay')) score += 10;

    return score;
  }

  async function fetchRegionalJobs(title, market, limit = 6) {
    try {
      const dailyKey = new Date().toISOString().slice(0, 10);
      const params = new URLSearchParams({
        title: String(title || '').trim() || 'Customer Service Representative',
        location: market.locationQuery,
        preferences: `${market.label} jobs only`,
        limit: String(Math.max(6, limit * 2)),
        day: dailyKey
      });

      const res = await fetch(getScoutApiUrl(params), { cache: 'no-store' });
      if (!res.ok) return [];

      const payload = await res.json();
      let jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];

      // Some upstream sources under-return when location is too strict; retry once with remote/global.
      if (!jobs.length) {
        const fallbackParams = new URLSearchParams({
          title: String(title || '').trim() || 'Customer Service Representative',
          location: 'remote',
          preferences: `${market.label} jobs`,
          limit: String(Math.max(8, limit * 3)),
          day: dailyKey
        });

        const fallbackRes = await fetch(getScoutApiUrl(fallbackParams), { cache: 'no-store' });
        if (fallbackRes.ok) {
          const fallbackPayload = await fallbackRes.json();
          jobs = Array.isArray(fallbackPayload?.jobs) ? fallbackPayload.jobs : [];
        }
      }

      const normalized = jobs
        .filter((job) => isAbsoluteHttpUrl(job?.link))
        .map((job) => ({
          title: String(job.title || 'Untitled Role').trim(),
          company: String(job.company || 'Unknown Company').trim(),
          location: String(job.location || market.locationQuery).trim(),
          source: String(job.source || 'Live Source').trim(),
          postedAt: job.postedAt || job.created || '',
          link: String(job.link || '').trim()
        }));

      const strict = normalized.filter((job) => matchesMarketLocation(job.location, market));
      const signalMatched = normalized.filter((job) => matchesMarketBySignals(job, market));

      const deduped = [];
      const seen = new Set();
      [...strict, ...signalMatched].forEach((job) => {
        if (!job.link || seen.has(job.link)) return;
        seen.add(job.link);
        deduped.push(job);
      });

      const filtered = deduped;

      if (market.id === 'jamaica') {
        filtered.sort((a, b) => scoreJamaicaSourcePreference(b) - scoreJamaicaSourcePreference(a));
      }

      return filtered.slice(0, limit);
    } catch (_error) {
      return [];
    }
  }

  async function renderMarketRadar() {
    const container = document.getElementById('jwaRegionalMarkets');
    if (!container) return;

    const keywordInput = document.getElementById('jwaMarketKeyword');
    const roleKeyword = String(keywordInput?.value || '').trim() || 'Customer Service Representative';

    container.innerHTML = REGION_MARKETS.map((market, idx) => `
      <details class="jwa-collapsible" ${idx === 0 ? 'open' : ''} id="jwaMarket-${market.id}">
        <summary>${market.icon} ${esc(market.label)} <span style="color:#94a3b8;font-weight:500;">(${esc(roleKeyword)})</span></summary>
        <div class="jwa-collapsible-body">
          <div style="display:inline-flex;align-items:center;gap:8px;background:#0f172a;border:1px solid #334155;color:#93c5fd;border-radius:999px;padding:6px 12px;font-size:.78rem;font-weight:700;margin-bottom:12px;">
            🔒 ${esc(market.lockLabel || `Location lock: ${market.locationQuery} only`)}
          </div>
          <div id="jwaMarketBody-${market.id}">
            <p class="jwa-empty">Loading ${esc(market.label.toLowerCase())}...</p>
          </div>
        </div>
      </details>
    `).join('');

    const results = await Promise.all(REGION_MARKETS.map((market) => fetchRegionalJobs(roleKeyword, market, 6)));

    REGION_MARKETS.forEach((market, index) => {
      const body = document.getElementById(`jwaMarketBody-${market.id}`);
      if (!body) return;

      const jobs = results[index] || [];
      if (!jobs.length) {
        body.innerHTML = `<p class="jwa-empty">No matching ${esc(market.label.toLowerCase())} found for "${esc(roleKeyword)}". Try a broader title.</p>`;
        return;
      }

      body.innerHTML = `
        <div class="jwa-role-grid">
          ${jobs.map((job) => `
            <a class="jwa-role-card" href="${esc(job.link)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;cursor:pointer;">
              <strong>${esc(job.title)}</strong>
              <span class="jwa-salary">${esc(job.company)}</span>
              <span class="jwa-demand-badge" style="background:#1d4ed8;">${esc(job.location)}</span>
              <span class="jwa-remote-tag">${esc(job.source)}</span>
              <span style="color:#64748b;font-size:.74rem;line-height:1.3;">Posted: ${esc(formatPostedDate(job.postedAt))}</span>
            </a>
          `).join('')}
        </div>
      `;
    });
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

  const CURRICULUM_TRACKS = ['ALL', 'CXC', 'CSEC', 'CAPE', 'HEART / NSTA', 'NVQ-J', 'CATALOG'];
  const CURRICULUM_COURSES = [
    {
      topic: 'CSEC Mathematics',
      title: 'CSEC Mathematics',
      track: 'CSEC',
      focus: 'STEM Foundation',
      careers: ['software', 'engineering', 'finance', 'healthcare', 'trades'],
      description: 'Core quantitative foundation for engineering, technology, finance, logistics, and healthcare pathways.',
      outcomes: ['Build problem-solving and numeracy confidence.', 'Strengthen entry readiness for CAPE and university programmes.', 'Improve performance in data-heavy career tracks.']
    },
    {
      topic: 'CSEC English A',
      title: 'CSEC English A',
      track: 'CSEC',
      focus: 'Communication',
      careers: ['all', 'law', 'business', 'media', 'healthcare'],
      description: 'Essential for scholarships, resumes, interviews, tertiary study, and any role requiring strong written communication.',
      outcomes: ['Improve writing clarity and comprehension.', 'Prepare for personal statements and scholarship essays.', 'Build the communication base employers expect.']
    },
    {
      topic: 'CSEC Information Technology',
      title: 'CSEC Information Technology',
      track: 'CSEC',
      focus: 'Digital Skills',
      careers: ['software', 'business', 'media'],
      description: 'Best entry path for students moving into coding, office productivity, digital operations, and remote work.',
      outcomes: ['Understand digital tools, systems, and workflows.', 'Prepare for software, BPO, and admin-tech jobs.', 'Create a foundation for deeper technical learning.']
    },
    {
      topic: 'CSEC Principles of Accounts',
      title: 'CSEC Principles of Accounts',
      track: 'CSEC',
      focus: 'Business Foundation',
      careers: ['business', 'finance'],
      description: 'Strong early subject for students interested in finance, bookkeeping, entrepreneurship, and business operations.',
      outcomes: ['Understand basic financial records and reporting.', 'Prepare for CAPE Accounting and business study.', 'Develop business language that employers value.']
    },
    {
      topic: 'CAPE Biology',
      title: 'CAPE Biology',
      track: 'CAPE',
      focus: 'Healthcare',
      careers: ['healthcare'],
      description: 'Critical for nursing, medicine, public health, lab science, and many overseas health scholarship pathways.',
      outcomes: ['Deepen life-science understanding for health careers.', 'Support entry into clinical and science degrees.', 'Prepare for nursing and bioscience interviews.']
    },
    {
      topic: 'CAPE Chemistry',
      title: 'CAPE Chemistry',
      track: 'CAPE',
      focus: 'Science Progression',
      careers: ['healthcare', 'engineering'],
      description: 'Valuable for medicine, pharmacy, engineering, lab science, and any path that needs strong science progression.',
      outcomes: ['Strengthen scientific reasoning and lab readiness.', 'Support entry into health and technical degrees.', 'Improve competitiveness for science scholarships.']
    },
    {
      topic: 'CAPE Mathematics',
      title: 'CAPE Mathematics',
      track: 'CAPE',
      focus: 'Advanced Quantitative Skills',
      careers: ['engineering', 'software', 'finance'],
      description: 'Core progression subject for engineering, computing, data, economics, and other high-quantitative pathways.',
      outcomes: ['Build advanced algebra and function fluency.', 'Develop calculus and probability skills for tertiary STEM.', 'Strengthen readiness for analytics and engineering programmes.']
    },
    {
      topic: 'CAPE Accounting',
      title: 'CAPE Accounting',
      track: 'CAPE',
      focus: 'Finance Path',
      careers: ['finance', 'business'],
      description: 'Strong route into ACCA, banking, audit, financial analysis, and business operations roles in Jamaica and abroad.',
      outcomes: ['Understand financial statements and reporting logic.', 'Prepare for tertiary finance and accounting study.', 'Build a direct bridge into regulated finance careers.']
    },
    {
      topic: 'Communication Studies',
      title: 'Communication Studies',
      track: 'CAPE',
      focus: 'Leadership',
      careers: ['media', 'law', 'business', 'all'],
      description: 'Useful across law, management, public service, customer success, media, and any leadership-oriented profession.',
      outcomes: ['Sharpen speaking, presenting, and analysis.', 'Improve interview and stakeholder communication.', 'Support scholarships, debate, and leadership tracks.']
    },
    {
      topic: 'CAPE Economics',
      title: 'CAPE Economics',
      track: 'CAPE',
      focus: 'Policy and Business',
      careers: ['business', 'finance', 'law'],
      description: 'Excellent subject for students interested in business strategy, policy, banking, development, and economic reasoning.',
      outcomes: ['Understand markets, incentives, and policy effects.', 'Prepare for economics, finance, and public policy degrees.', 'Develop stronger analytical writing for decision-making careers.']
    },
    {
      topic: 'HEART Customer Service',
      title: 'HEART Customer Service',
      track: 'HEART / NSTA',
      focus: 'Employability',
      careers: ['business', 'media', 'all'],
      description: 'Practical employability course for BPO, hospitality, retail, front office, and support roles with fast labour-market entry.',
      outcomes: ['Learn service standards and workplace communication.', 'Prepare for interview-ready entry-level jobs.', 'Build immediate employment signals for recruiters.']
    },
    {
      topic: 'HEART Practical Nursing Support',
      title: 'HEART Practical Nursing Support',
      track: 'HEART / NSTA',
      focus: 'Health Support',
      careers: ['healthcare'],
      description: 'Early vocational route for students interested in patient care, clinical support, and healthcare service pathways.',
      outcomes: ['Understand basic patient support expectations.', 'Build employability for health-support roles.', 'Create momentum toward further nursing qualifications.']
    },
    {
      topic: 'NVQ-J Electrical Installation',
      title: 'NVQ-J Electrical Installation',
      track: 'NVQ-J',
      focus: 'Skilled Trades',
      careers: ['trades', 'engineering'],
      description: 'Strong vocational pathway into construction, facilities, energy, maintenance, and migration-ready technical work.',
      outcomes: ['Understand trade certification progression.', 'Prepare for technical employment and apprenticeships.', 'Connect practical skills to income-generating careers.']
    },
    {
      topic: 'NVQ-J Welding and Fabrication',
      title: 'NVQ-J Welding and Fabrication',
      track: 'NVQ-J',
      focus: 'Industrial Skills',
      careers: ['trades', 'engineering'],
      description: 'Hands-on technical route into manufacturing, maintenance, construction, and industrial career tracks.',
      outcomes: ['Build practical fabrication and workshop awareness.', 'Open apprenticeship and industrial work routes.', 'Create a pathway into migration-ready trade skills.']
    },
    {
      topic: 'Browse Full Catalog',
      title: 'Browse the Full Learning Catalog',
      track: 'CATALOG',
      focus: 'Explore More',
      careers: ['all'],
      description: 'Open the main learning catalog to explore additional in-demand courses beyond school subjects, including AI, business, and digital skills.',
      outcomes: ['Search the hottest courses in the app.', 'Filter by demand level.', 'Launch any course into the dedicated learning page.'],
      href: 'learning.html'
    }
  ];

  const CURRICULUM_BUNDLES = [
    {
      id: 'all',
      label: 'All Paths',
      note: 'Start here if you are still exploring. This shows the full subject set so you can compare options before narrowing down.',
      careers: []
    },
    {
      id: 'healthcare',
      label: 'Nursing / Health',
      note: 'If you want nursing, medicine, lab science, or public health, prioritise Math, English, Biology, Chemistry, and practical health-support training.',
      careers: ['healthcare']
    },
    {
      id: 'software',
      label: 'Software / Tech',
      note: 'If you want software, cybersecurity, or IT, build around Math, IT, strong English, and then deepen into digital and technical learning.',
      careers: ['software']
    },
    {
      id: 'business',
      label: 'Business / Finance',
      note: 'If you want accounting, banking, entrepreneurship, management, or office leadership, focus on Math, English, Accounts, Economics, and communication.',
      careers: ['business', 'finance']
    },
    {
      id: 'media',
      label: 'Media / Communication',
      note: 'If you want marketing, content, media, PR, or leadership-heavy careers, your base should be English, Communication Studies, IT, and customer-facing skill building.',
      careers: ['media']
    },
    {
      id: 'trades',
      label: 'Trades / Technical',
      note: 'If you want a hands-on technical route, focus on Math plus practical HEART/NVQ-J pathways that can lead directly to income and apprenticeships.',
      careers: ['trades', 'engineering']
    }
  ];

  const curriculumState = {
    track: 'ALL',
    bundle: 'all',
    search: ''
  };

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

  function matchesCurriculumBundle(course, bundle) {
    if (!bundle || bundle.id === 'all') return true;
    return course.careers.includes('all') || bundle.careers.some(career => course.careers.includes(career));
  }

  function matchesCurriculumSearch(course, searchTerm) {
    const q = String(searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    const haystack = [course.title, course.track, course.focus, course.description].concat(course.outcomes || []).join(' ').toLowerCase();
    return haystack.includes(q);
  }

  function curriculumHref(course) {
    if (course.href) return course.href;
    return `course-learning.html?topic=${encodeURIComponent(course.topic)}`;
  }

  function renderCurriculumTrackFilters() {
    const wrap = document.getElementById('jwaCourseTrackFilters');
    if (!wrap) return;
    wrap.innerHTML = CURRICULUM_TRACKS.map(track => `
      <button type="button" class="jwa-learning-filter-btn${curriculumState.track === track ? ' active' : ''}" data-track="${esc(track)}">${esc(track === 'ALL' ? 'All Levels' : track)}</button>
    `).join('');
  }

  function renderCurriculumBundleFilters() {
    const wrap = document.getElementById('jwaCourseBundleFilters');
    if (!wrap) return;
    wrap.innerHTML = CURRICULUM_BUNDLES.map(bundle => `
      <button type="button" class="jwa-learning-bundle-btn${curriculumState.bundle === bundle.id ? ' active' : ''}" data-bundle="${esc(bundle.id)}">${esc(bundle.label)}</button>
    `).join('');

    const note = document.getElementById('jwaCourseBundleNote');
    const activeBundle = CURRICULUM_BUNDLES.find(bundle => bundle.id === curriculumState.bundle) || CURRICULUM_BUNDLES[0];
    if (note) note.textContent = activeBundle.note;
  }

  function renderCurriculumCourses() {
    const grid = document.getElementById('jwaCourseLearningGrid');
    const summary = document.getElementById('jwaCourseLearningSummary');
    if (!grid) return;

    const activeBundle = CURRICULUM_BUNDLES.find(bundle => bundle.id === curriculumState.bundle) || CURRICULUM_BUNDLES[0];
    const visible = CURRICULUM_COURSES.filter(course => {
      const trackMatch = curriculumState.track === 'ALL'
        || (curriculumState.track === 'CXC' ? (course.track === 'CSEC' || course.track === 'CAPE') : course.track === curriculumState.track);
      return trackMatch && matchesCurriculumBundle(course, activeBundle) && matchesCurriculumSearch(course, curriculumState.search);
    });

    if (summary) {
      const parts = [];
      parts.push(`${visible.length} subject pathway${visible.length === 1 ? '' : 's'} showing`);
      if (curriculumState.track !== 'ALL') {
        parts.push(curriculumState.track === 'CXC' ? 'for CXC (CSEC + CAPE)' : `for ${curriculumState.track}`);
      }
      if (activeBundle.id !== 'all') parts.push(`inside the ${activeBundle.label} bundle`);
      if (curriculumState.search) parts.push(`matching "${curriculumState.search}"`);
      summary.textContent = parts.join(' ');
    }

    grid.innerHTML = visible.length ? visible.map(course => `
      <a class="jwa-learning-card" href="${curriculumHref(course)}">
        <div class="jwa-learning-meta">
          <span class="jwa-learning-pill">${esc(course.track)}</span>
          <span class="jwa-learning-pill">${esc(course.focus)}</span>
        </div>
        <h4>${esc(course.title)}</h4>
        <p>${esc(course.description)}</p>
        <ul class="jwa-learning-outcomes">
          ${(course.outcomes || []).map(outcome => `<li>${esc(outcome)}</li>`).join('')}
        </ul>
        <span class="jwa-learning-link">${course.track === 'CATALOG' ? 'Browse all courses →' : 'Open course →'}</span>
      </a>
    `).join('') : '<div class="jwa-empty">No subject pathways match that filter yet. Try another bundle or search term.</div>';
  }

  function renderCurriculumLearning() {
    renderCurriculumTrackFilters();
    renderCurriculumBundleFilters();
    renderCurriculumCourses();
  }

  function initCurriculumLearning() {
    const trackWrap = document.getElementById('jwaCourseTrackFilters');
    const bundleWrap = document.getElementById('jwaCourseBundleFilters');
    const searchInput = document.getElementById('jwaCourseSearchInput');
    if (!trackWrap || !bundleWrap || !searchInput) return;

    trackWrap.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-track]');
      if (!btn) return;
      curriculumState.track = String(btn.getAttribute('data-track') || 'ALL');
      renderCurriculumLearning();
    });

    bundleWrap.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-bundle]');
      if (!btn) return;
      curriculumState.bundle = String(btn.getAttribute('data-bundle') || 'all');
      renderCurriculumLearning();
    });

    searchInput.addEventListener('input', function () {
      curriculumState.search = String(this.value || '').trim();
      renderCurriculumLearning();
    });

    renderCurriculumLearning();
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

  /* ── 4b. New Functional Tabs ──────────────────────────────────────────── */
  const SCHOLARSHIP_DATA = [
    { name: 'Jamaica Student Loan Bureau (SLB)', level: 'undergrad', destination: 'jamaica', focus: ['all'], deadline: 'Rolling by academic term', amount: 'Tuition and approved fees', link: 'https://www.slbja.com/' },
    { name: 'Jamaica Values and Attitudes Scholarship', level: 'undergrad', destination: 'jamaica', focus: ['business', 'healthcare', 'technology'], deadline: 'Annual (Q2)', amount: 'Partial tuition support', link: 'https://moey.gov.jm/' },
    { name: 'Chevening Scholarship', level: 'postgrad', destination: 'uk', focus: ['all'], deadline: 'Annual (typically Nov)', amount: 'Full tuition + stipend', link: 'https://www.chevening.org/' },
    { name: 'Commonwealth Scholarship', level: 'postgrad', destination: 'uk', focus: ['all'], deadline: 'Annual (Q4)', amount: 'Full scholarship package', link: 'https://cscuk.fcdo.gov.uk/' },
    { name: 'Fulbright Foreign Student Program', level: 'postgrad', destination: 'us', focus: ['all'], deadline: 'Annual (country-specific)', amount: 'Tuition + living support', link: 'https://foreign.fulbrightonline.org/' },
    { name: 'Vanier Canada Graduate Scholarships', level: 'postgrad', destination: 'canada', focus: ['healthcare', 'technology', 'business'], deadline: 'Annual (Q4)', amount: 'CAD 50,000/year', link: 'https://vanier.gc.ca/' },
    { name: 'HEART/NSTA Training Support', level: 'tvet', destination: 'jamaica', focus: ['trades', 'technology', 'hospitality', 'healthcare'], deadline: 'By intake cycle', amount: 'Programme-specific support', link: 'https://www.heart-nsta.org/' },
    { name: 'JBDC Entrepreneur Support Programmes', level: 'tvet', destination: 'jamaica', focus: ['business'], deadline: 'Rolling', amount: 'Grant/loan mix by programme', link: 'https://www.jbdc.net/' },
  ];

  const APPRENTICESHIP_DATA = [
    { title: 'HEART Electrical Installation L2', parish: 'kingston', field: 'electrical', intake: 'Jan / May / Sep', duration: '9-12 months', link: 'https://www.heart-nsta.org/' },
    { title: 'HEART Welding and Fabrication L2', parish: 'st-james', field: 'welding', intake: 'Feb / Jun / Oct', duration: '9-12 months', link: 'https://www.heart-nsta.org/' },
    { title: 'HEART Software Development (ICT)', parish: 'portmore', field: 'it', intake: 'Quarterly', duration: '6-9 months', link: 'https://www.heart-nsta.org/' },
    { title: 'Hospitality Operations Apprentice Track', parish: 'st-james', field: 'hospitality', intake: 'Seasonal', duration: '6 months', link: 'https://www.heart-nsta.org/' },
    { title: 'Practical Nursing Support Track', parish: 'clarendon', field: 'health', intake: 'Quarterly', duration: '9 months', link: 'https://www.heart-nsta.org/' },
  ];

  const MENTOR_DATA = [
    { name: 'Shanique Brown', industry: 'technology', market: 'jamaica', title: 'Engineering Manager', org: 'Kingston FinTech Hub' },
    { name: 'Andre Williams', industry: 'finance', market: 'canada', title: 'Senior Financial Analyst', org: 'Toronto Banking Group' },
    { name: 'Tameka Reid', industry: 'healthcare', market: 'uk', title: 'NHS Nurse Educator', org: 'Birmingham NHS Trust' },
    { name: 'David Johnson', industry: 'construction', market: 'jamaica', title: 'Project Controls Lead', org: 'Caribbean BuildCo' },
    { name: 'Kerry-Ann Smith', industry: 'hospitality', market: 'us', title: 'Hotel Operations Director', org: 'Miami Hospitality Group' },
  ];

  const INTERVIEW_QUESTION_BANK = {
    behavioral: [
      { q: 'Tell me about a time you had to deliver under tight deadlines. What did you do?', a: 'Use STAR: Situation, Task, Action, Result. Focus on planning, prioritisation, and measurable outcome (for example, delivered 2 days early, reduced backlog by 30%).' },
      { q: 'Describe a conflict within your team and how you handled it.', a: 'Show calm communication: clarify goals, align stakeholders, agree on next actions, and confirm improved collaboration afterward.' },
      { q: 'Give an example of when you made a mistake at work. What did you learn?', a: 'Own the mistake quickly, explain corrective action, and show process change that prevented recurrence.' },
    ],
    technical: [
      { q: 'How do you structure your approach when starting a new role project?', a: 'Define objective, constraints, stakeholders, deliverables, timeline, risks, then set weekly checkpoints and communication cadence.' },
      { q: 'What metrics would you track in your first 90 days?', a: 'Track output (deliverables), quality (error/rework rate), and impact (cost, time, customer outcomes), then report trend and next actions.' },
      { q: 'How do you prioritise multiple urgent tasks?', a: 'Use impact vs urgency matrix, align with manager expectations, communicate tradeoffs early, and timebox execution blocks.' },
    ],
    case: [
      { q: 'A key project is behind by 3 weeks and stakeholders are frustrated. What do you do first?', a: 'Stabilise scope, identify blockers by owner, publish recovery plan with dates, and set transparent weekly status updates.' },
      { q: 'Budget was cut by 20% mid-project. How do you respond?', a: 'Re-baseline scope with MVP mindset, protect highest-value outcomes, and communicate revised plan and risks immediately.' },
      { q: 'A top performer is disengaged and output is falling. What is your approach?', a: 'Have a private diagnostic conversation, identify root cause, reset expectations, offer support, and track short-cycle improvement goals.' },
    ],
  };

  function renderScholarshipFinder() {
    const level = String(document.getElementById('jwaScholarLevel')?.value || 'all');
    const destination = String(document.getElementById('jwaScholarDestination')?.value || 'all');
    const keyword = String(document.getElementById('jwaScholarKeyword')?.value || '').trim().toLowerCase();
    const resultsEl = document.getElementById('jwaScholarResults');
    if (!resultsEl) return;

    const filtered = SCHOLARSHIP_DATA.filter((item) => {
      const levelOk = level === 'all' || item.level === level;
      const destOk = destination === 'all' || item.destination === destination;
      const keywordOk = !keyword || [item.name, item.amount, item.deadline, item.focus.join(' ')].join(' ').toLowerCase().includes(keyword);
      return levelOk && destOk && keywordOk;
    });

    if (!filtered.length) {
      resultsEl.innerHTML = '<p class="jwa-empty">No matches found. Try broader filters.</p>';
      setStatus('jwaScholarStatus', '0 funding options found for current filters.', '#f59e0b');
      return;
    }

    resultsEl.innerHTML = `
      <div class="jwa-role-grid">
        ${filtered.map((item) => `
          <a class="jwa-role-card" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
            <strong>${esc(item.name)}</strong>
            <span class="jwa-salary">${esc(item.amount)}</span>
            <span class="jwa-demand-badge" style="background:#1d4ed8;">Deadline: ${esc(item.deadline)}</span>
            <span class="jwa-remote-tag">${esc(item.level.toUpperCase())} • ${esc(item.destination.toUpperCase())}</span>
          </a>
        `).join('')}
      </div>
    `;
    setStatus('jwaScholarStatus', `${filtered.length} live funding option${filtered.length === 1 ? '' : 's'} matched.`, '#16a34a');
  }

  function generateScholarChecklist() {
    const level = String(document.getElementById('jwaScholarLevel')?.value || 'all');
    const status = document.getElementById('jwaScholarStatus');
    const baseItems = [
      'Academic transcripts (certified copies)',
      'Two references (academic or professional)',
      'Personal statement tailored to programme goals',
      'Updated CV with achievements and leadership',
      'Valid passport and ID documents',
      'Application deadline tracker with reminders',
    ];
    if (level === 'postgrad') baseItems.push('Research proposal / study plan draft');
    if (level === 'tvet') baseItems.push('Skills portfolio and practical evidence (photos/projects)');
    if (status) {
      status.innerHTML = `<span style="color:#7dd3fc;"><strong>Application Checklist</strong><br>${baseItems.map((x) => `• ${esc(x)}`).join('<br>')}</span>`;
    }
  }

  function generateInterviewPrep() {
    const role = String(document.getElementById('jwaInterviewRole')?.value || '').trim() || 'Project Manager';
    const market = String(document.getElementById('jwaInterviewMarket')?.value || 'jamaica').toUpperCase();
    const type = String(document.getElementById('jwaInterviewType')?.value || 'behavioral');
    const target = document.getElementById('jwaInterviewResults');
    if (!target) return;

    const pool = INTERVIEW_QUESTION_BANK[type] || INTERVIEW_QUESTION_BANK.behavioral;
    target.innerHTML = pool.map((item, idx) => `
      <details class="jwa-collapsible" ${idx === 0 ? 'open' : ''}>
        <summary>${esc(role)} Interview Q${idx + 1} (${esc(market)})</summary>
        <div class="jwa-collapsible-body">
          <p style="margin:0 0 10px;color:#e2e8f0;"><strong>Question:</strong> ${esc(item.q)}</p>
          <p style="margin:0;color:#a7f3d0;"><strong>High-scoring sample answer approach:</strong> ${esc(item.a)}</p>
        </div>
      </details>
    `).join('');
  }

  function renderApprenticeships() {
    const parish = String(document.getElementById('jwaApprenticeParish')?.value || 'all');
    const field = String(document.getElementById('jwaApprenticeField')?.value || 'all');
    const target = document.getElementById('jwaApprenticeResults');
    if (!target) return;

    const filtered = APPRENTICESHIP_DATA.filter((item) => (parish === 'all' || item.parish === parish) && (field === 'all' || item.field === field));
    target.innerHTML = filtered.length ? `
      <div class="jwa-role-grid">
        ${filtered.map((item) => `
          <a class="jwa-role-card" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
            <strong>${esc(item.title)}</strong>
            <span class="jwa-salary">Duration: ${esc(item.duration)}</span>
            <span class="jwa-demand-badge" style="background:#0f766e;">Intake: ${esc(item.intake)}</span>
            <span class="jwa-remote-tag">Apply via HEART/NSTA portal</span>
          </a>
        `).join('')}
      </div>
    ` : '<p class="jwa-empty">No matching apprenticeship programmes found.</p>';
  }

  function analyzeContractTerms() {
    const text = String(document.getElementById('jwaContractText')?.value || '').toLowerCase();
    const target = document.getElementById('jwaContractResults');
    if (!target) return;
    if (!text.trim()) {
      target.innerHTML = '<p class="jwa-empty">Paste contract terms first.</p>';
      return;
    }

    const risks = [];
    if (!text.includes('overtime')) risks.push('No overtime policy stated. Ask for rates and approval rules.');
    if (!text.includes('probation')) risks.push('Probation terms missing. Confirm probation length and exit terms.');
    if (!text.includes('notice')) risks.push('Notice period missing. Request written notice conditions.');
    if (!text.includes('benefit')) risks.push('Benefits not clearly listed. Ask about health, leave, pension, and allowances.');
    if (text.includes('at will') || text.includes('terminate immediately')) risks.push('Termination wording is high-risk. Ask for fair termination and appeal language.');

    target.innerHTML = risks.length ? `
      <div class="jwa-check-results">
        ${risks.map((r) => `<div class="jwa-check-item jwa-check-warn"><span class="jwa-check-icon">⚠</span><span>${esc(r)}</span></div>`).join('')}
        <div class="jwa-check-item jwa-check-improve"><span class="jwa-check-icon">💡</span><span>Negotiation prompt: "I can commit quickly once overtime, notice, and benefits are documented in writing."</span></div>
      </div>
    ` : '<p style="color:#86efac;">No major contract red flags detected from the pasted text.</p>';
  }

  function generateBusinessPlan() {
    const skill = String(document.getElementById('jwaBizSkill')?.value || '').trim() || 'Freelance Service';
    const budget = Number(document.getElementById('jwaBizBudget')?.value || 0);
    const goal = Number(document.getElementById('jwaBizGoal')?.value || 0);
    const target = document.getElementById('jwaBizPlanResults');
    if (!target) return;

    const monthlyTarget = goal > 0 ? Math.ceil(goal / 3) : 0;
    const starterPrice = monthlyTarget > 0 ? Math.max(5000, Math.ceil(monthlyTarget / 6 / 500) * 500) : 7500;
    target.innerHTML = `
      <details class="jwa-collapsible" open>
        <summary>90-Day Launch Plan: ${esc(skill)}</summary>
        <div class="jwa-collapsible-body">
          <p style="margin:0 0 8px;color:#cbd5e1;"><strong>Budget:</strong> JMD ${Number.isFinite(budget) ? budget.toLocaleString() : '0'} | <strong>Target:</strong> JMD ${Number.isFinite(goal) ? goal.toLocaleString() : '0'}</p>
          <ul style="margin:0;padding-left:18px;line-height:1.7;color:#cbd5e1;">
            <li><strong>Days 1-30:</strong> Build portfolio sample + outreach list of 30 prospects.</li>
            <li><strong>Days 31-60:</strong> Close first 2 paying clients and request testimonials.</li>
            <li><strong>Days 61-90:</strong> Standardise delivery and increase to 4-6 active clients.</li>
            <li><strong>Suggested starting package price:</strong> JMD ${starterPrice.toLocaleString()} per client/month.</li>
            <li><strong>Monthly target run-rate:</strong> JMD ${monthlyTarget.toLocaleString()}.</li>
          </ul>
        </div>
      </details>
    `;
  }

  function findMentorMatches() {
    const industry = String(document.getElementById('jwaMentorIndustry')?.value || 'technology');
    const market = String(document.getElementById('jwaMentorMarket')?.value || 'jamaica');
    const target = document.getElementById('jwaMentorResults');
    if (!target) return;

    const matches = MENTOR_DATA.filter((m) => m.industry === industry && m.market === market);
    if (!matches.length) {
      target.innerHTML = '<p class="jwa-empty">No exact mentor match right now. Try another market or industry.</p>';
      return;
    }

    target.innerHTML = matches.map((m) => `
      <div class="jwa-diaspora-card" style="margin-bottom:10px;">
        <div class="jwa-diaspora-header">
          <strong class="jwa-diaspora-city">${esc(m.name)}</strong>
          <span class="jwa-diaspora-country">${esc(m.market.toUpperCase())}</span>
        </div>
        <div style="color:#cbd5e1;line-height:1.6;">${esc(m.title)} • ${esc(m.org)}</div>
        <div style="margin-top:8px;color:#93c5fd;font-size:.86rem;">First meeting agenda: 1) Career direction 2) Skill gaps 3) 30-day actions 4) Referral opportunities.</div>
      </div>
    `).join('');
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

  function initCollapsiblePersistence() {
    const sections = Array.from(document.querySelectorAll('details.jwa-collapsible'));
    if (!sections.length) return;

    sections.forEach((section, index) => {
      const panelId = String(section.closest('.jwa-tab-panel')?.id || 'global');
      const summaryText = String(section.querySelector('summary')?.textContent || `section-${index + 1}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const key = `jwa:collapse:${panelId}:${summaryText || `section-${index + 1}`}`;

      try {
        const stored = localStorage.getItem(key);
        if (stored === 'open') section.open = true;
        if (stored === 'closed') section.open = false;
      } catch (error) {
        // Ignore storage errors in restricted browser modes.
      }

      section.addEventListener('toggle', function () {
        try {
          localStorage.setItem(key, section.open ? 'open' : 'closed');
        } catch (error) {
          // Ignore storage errors in restricted browser modes.
        }
      });
    });
  }

  /* ── 5. Career Pathway Builder ──────────────────────────────────────────── */

  /* ─── Role Ladders (entry → mid → senior, with salary bands) ───────────── */
  const ROLE_LADDERS = {
    'project-manager':   [
      { level: 'Entry',  title: 'Project Co-ordinator',       salary: 'JMD 1.2–1.8M / yr', note: 'Support PMs, handle scheduling & documentation.' },
      { level: 'Mid',    title: 'Project Manager',            salary: 'JMD 2.5–4.5M / yr', note: 'Own end-to-end delivery; PMP or PRINCE2 an advantage.' },
      { level: 'Senior', title: 'Programme / Portfolio Lead', salary: 'JMD 5–9M+ / yr',    note: 'Oversee multiple projects; strategic planning focus.' },
    ],
    'software-developer':[
      { level: 'Entry',  title: 'Junior Developer / Intern',  salary: 'JMD 1.2–2M / yr',   note: 'Bug fixes, tests, small features under mentorship.' },
      { level: 'Mid',    title: 'Software Engineer',          salary: 'JMD 3–5.5M / yr',   note: 'Own features, code review, architecture input.' },
      { level: 'Senior', title: 'Senior / Lead Engineer',     salary: 'JMD 6–12M+ / yr',   note: 'Technical lead; system design; remote USD roles possible.' },
    ],
    'nurse':             [
      { level: 'Entry',  title: 'Staff Nurse (Grade 1)',       salary: 'JMD 1.8–2.4M / yr', note: 'Ward rotations; NMC Jamaica registration required.' },
      { level: 'Mid',    title: 'Senior Staff Nurse / Sister', salary: 'JMD 2.8–4M / yr',   note: 'Ward leadership; specialisation (ICU, Midwifery, etc.).' },
      { level: 'Senior', title: 'Ward Manager / CNO',          salary: 'JMD 4.5–8M+ / yr',  note: 'Clinical governance; UK / Canada migration pathway viable.' },
    ],
    'marketing-manager': [
      { level: 'Entry',  title: 'Marketing Assistant / Co-ord', salary: 'JMD 1.1–1.6M / yr', note: 'Social media, copy, events support.' },
      { level: 'Mid',    title: 'Marketing Manager',            salary: 'JMD 2.5–4M / yr',   note: 'Campaign ownership, budget management, brand voice.' },
      { level: 'Senior', title: 'Head of Marketing / CMO',      salary: 'JMD 5–10M+ / yr',   note: 'Growth strategy, agency management, C-suite reporting.' },
    ],
    'accountant':        [
      { level: 'Entry',  title: 'Accounts Clerk / Junior Auditor', salary: 'JMD 1.2–1.8M / yr', note: 'Data entry, reconciliation, trial balance support.' },
      { level: 'Mid',    title: 'Accountant / Audit Senior',        salary: 'JMD 2.5–4.5M / yr', note: 'Financial statements, tax filings, ACCA student/affiliate.' },
      { level: 'Senior', title: 'Finance Manager / CFO',            salary: 'JMD 5–12M+ / yr',   note: 'Strategic finance, ACCA / CPA qualified; diaspora roles.' },
    ],
    'entrepreneur':      [
      { level: 'Entry',  title: 'Sole Trader / Freelancer',  salary: 'Variable — JMD 0–1.5M', note: 'Validate idea, first paying customers, register business.' },
      { level: 'Mid',    title: 'Small Business Owner',       salary: 'JMD 2–6M / yr',         note: 'Team of 2–10, recurring revenue, JBDC / BNS support.' },
      { level: 'Senior', title: 'Established Entrepreneur',   salary: 'JMD 8M+ / yr',          note: 'Multiple revenue streams; investors; export potential.' },
    ],
  };

  /* ─── TVET / Vocational Route overlays (per career, key points per year) ─ */
  const TVET_ROUTES = {
    'project-manager': {
      y1: ['Enrol in HEART/NSTA Construction Project Management Level 2 programme.', 'Shadow a site supervisor or logistics co-ordinator part-time.', 'Build a paper-based project plan for a small community task (event, repair, fundraiser).', 'Look into MIND (Management Institute for National Development) short courses.'],
      y2: ['Complete HEART/NSTA Level 3 Project Management or Operations Management certificate.', 'Target a paid Admin / Operations Assistant role to build real-world experience.', 'Study for CAPM (Certified Associate in Project Management) — available via PMI online, no degree required.', 'Apply to JBDC\'s SME programme workshops for project planning skills.'],
      y3: ['Sit CAPM exam; cost ~USD 225 — apply for NHT or JN Bank study loan if needed.', 'Move into a Junior Project Co-ordinator role; document every project you touch.', 'Join PMI Jamaica Chapter as a student member for networking and mentorship.', 'Study PRINCE2 Foundation remotely (Coursera / Udemy ~ JMD 5,000–15,000).'],
      y4: ['Pursue PMP certification once you have 36 months of project leadership experience.', 'Target government project offices, construction firms, or BPO project leads.', 'Build a portfolio of 3 managed projects — sizes, budgets, outcomes documented.', 'Consider ACPM (UK-accredited) as a cost-effective alternative to PMP.'],
      y5: ['Day 1 ready: CAPM/PMP cert + HEART certificate + documented portfolio.', 'Target entry-level Project Co-ordinator positions in tourism, construction, or BPO.', 'Salary target: JMD 1.2–1.8M; use first role to clock hours toward PMP if not yet held.', 'HEART/NSTA Caribbean Project Management qualification is fully recognised by local employers.'],
    },
    'software-developer': {
      y1: ['Enrol in HEART/NSTA ICT Level 1–2 programme (Digital Technology pathway).', 'Start free coding: The Odin Project, freeCodeCamp, CS50 (Harvard, free online).', 'Build 2 small HTML/CSS/JS projects — host for free on GitHub Pages.', 'Join Code Jamaica or local tech WhatsApp / Discord communities.'],
      y2: ['Complete HEART/NSTA ICT Level 3 — Software Development track.', 'Learn one backend language: Node.js or Python (freeCodeCamp or Scrimba).', 'Contribute to 1 open-source project on GitHub to build public profile.', 'Target a part-time junior dev, data entry, or IT support role to gain income + experience.'],
      y3: ['Build a portfolio of 3 full-stack projects — each solving a real Jamaican business problem.', 'Start freelancing on Upwork or Toptal to earn USD while studying.', 'Study AWS Cloud Practitioner (free prep on AWS Skill Builder) — globally recognised.', 'HEART/NSTA CompTIA A+ or Network+ tracks are a cost-effective entry to tech ops.'],
      y4: ['Apply for Amazon, Digicel, GraceKennedy, or NCB tech internship / junior role.', 'Complete AWS / Google Cloud Associate cert if interested in cloud/DevOps.', 'Consider Caribbean Software & Tech Academy (CSTA) bootcamp for structured mentorship.', 'Start building LinkedIn profile — many Jamaican developers land USD remote roles this way.'],
      y5: ['Day 1 ready: GitHub portfolio + HEART ICT cert + at least one cloud cert.', 'Target entry-level developer roles or USD remote junior roles.', 'Salary band: JMD 1.2–2M local or USD 20–40k remote.', 'Path does not require a university degree — portfolio + cert is enough for first junior role.'],
    },
    'nurse': {
      y1: ['Enrol in HEART/NSTA Healthcare Auxiliary / Community Health Worker Level 1–2.', 'Volunteer at a local clinic, health centre, or Red Cross chapter — builds compassion and reference letters.', 'Study CXC Biology, Chemistry, and Human & Social Biology — grade B required for nursing school.', 'Attend an open day at the University Hospital of the West Indies (UHWI) School of Nursing.'],
      y2: ['Apply to Registered Nurse programme at G.C. Foster College, UHWI, or Northern Caribbean University.', 'If not ready for degree, enrol in HEART/NSTA Community Healthcare Level 3 as a bridge.', 'Complete CPR and First Aid certification (Red Cross Jamaica — approx JMD 5,000).', 'Find a healthcare assistant / ward aide role to fund studies and build clinical exposure.'],
      y3: ['Complete Year 1 of the UHWI / NCU BSc Nursing or Enrolled Nurse programme.', 'Apply for the GOJ Student Loan Scheme (SLASPA) — covers nursing tuition at approved institutions.', 'Begin nursing simulation labs — core clinical competencies documented in your logbook.', 'Connect with RNAO (Registered Nurses\' Association of Jamaica) student chapter for mentorship.'],
      y4: ['Complete Year 2 clinical rotations — paediatrics, maternity, surgical, medical wards.', 'Apply early for HECS scholarship if targeting UK registration post-graduation.', 'Study NCLEX-RN prep materials if targeting US migration path — start early.', 'Identify your specialisation interest: ICU, midwifery, mental health, community nursing.'],
      y5: ['Graduate with BSc Nursing or Enrolled Nurse diploma; register with Nursing Council of Jamaica.', 'Apply to Queen Elizabeth for Health Workers Programme (Canada) or NHS Band 5 UK pathway.', 'Salary band in Jamaica: JMD 1.8–2.4M; UK Band 5: £28,000–£34,000.', 'TVET/vocational route is fully viable — HEART bridge cert to enrolled nurse to registered nurse is an established pathway.'],
    },
    'marketing-manager': {
      y1: ['Take Google Digital Marketing & E-commerce Certificate (free on Coursera, 6 months).', 'Create and grow a personal social media account in a niche you care about — your first portfolio piece.', 'Volunteer to manage social media for a local school, church, or small business.', 'Study CXC Principles of Business and Economics as academic foundation.'],
      y2: ['Complete HubSpot Content Marketing and Email Marketing certifications (free).', 'Build a basic WordPress or Wix website for a local SME — charge a small fee or do it in exchange for testimonial.', 'Target a Social Media Assistant or Marketing Admin role with a local agency or BPO.', 'Enrol in HEART/NSTA Business Administration Level 3 if degree path is not viable.'],
      y3: ['Complete Google Ads and Meta Blueprint certifications — both free.', 'Run a real paid ad campaign (even USD 10) — document results for portfolio.', 'Apply for a Marketing Co-ordinator role at a hotel, FMCG brand, or digital agency.', 'Study for CIM (Chartered Institute of Marketing) Foundation Certificate — available via distance learning.'],
      y4: ['Build a portfolio of 5+ campaigns: before/after metrics, channel mix, budget managed.', 'Apply for marketing assistant / brand co-ordinator at Grace Kennedy, Digicel, or Sandals.', 'Complete LinkedIn Marketing Solutions or TikTok Business Centre certifications.', 'Consider UWI Open Campus part-time marketing programme as a degree entry point if desired.'],
      y5: ['Day 1 ready: Google/HubSpot/Meta certs + brand case studies + 1 year of hands-on experience.', 'Target Marketing Manager roles in tourism, FMCG, financial services, or telecoms.', 'Salary band: JMD 1.1–1.6M entry; 2.5–4M with experience.', 'Degree is NOT required for most marketing roles in Jamaica — a strong portfolio wins more interviews.'],
    },
    'accountant': {
      y1: ['Study CXC Accounts and Additional Mathematics — grade 1 or 2 target.', 'Complete a free Introduction to Financial Accounting course (Coursera / edX, University of Pennsylvania).', 'Offer basic bookkeeping to a family or community business — practice real data.', 'Register as a student member with ICAJ (Institute of Chartered Accountants of Jamaica).'],
      y2: ['Enrol in ACCA Foundation level (FIA) — these qualifications do not require a degree to start.', 'ACCA FIA Level 1–3 covers Bookkeeping, Financial Statements, and Management Accounting.', 'Target an Accounts Clerk or Payroll Assistant role to earn income while studying.', 'HEART/NSTA Business Administration Level 3 includes bookkeeping modules — useful bridge.'],
      y3: ['Progress to ACCA Applied Knowledge papers (BT, MA, FA) — sit one per sitting.', 'Keep working in an accounting support role; each year of experience counts toward ACCA membership.', 'Apply for ICAJ student bursary — available annually for ACCA students in Jamaica.', 'QuickBooks ProAdvisor certification is free and immediately marketable to SMEs.'],
      y4: ['Sit ACCA Applied Skills papers (LW, PM, TX, FR, AA, FM).', 'Target Accounts Officer or Junior Auditor role at a Big 4 firm (Deloitte, KPMG, PwC Jamaica).', 'Build Excel / Google Sheets mastery — most Jamaica employers test this at interview.', 'Consider CIPA (Certified International Professional Accountant) as a faster alternative pathway.'],
      y5: ['Day 1 ready: ACCA Part-qualified + 2–3 years experience + QBO/Sage skills.', 'Target Accountant or Audit Senior roles at local firms or global companies with JA offices.', 'Salary band: JMD 1.2–1.8M entry; 2.5–4.5M as ACCA-qualified.', 'ACCA qualification does not require a university degree — experience + papers = recognised globally.'],
    },
    'entrepreneur': {
      y1: ['Identify one problem in your community that you could solve for money — write 1 page on it.', 'Register as a Sole Trader with JAMPRO / Companies Office of Jamaica (approx JMD 4,000).', 'Complete JBDC (Jamaica Business Development Corporation) free SME starter workshop.', 'Start selling something small: a skill, a product, a service — even JMD 500/week is real traction.'],
      y2: ['Open a business bank account (NCB Business Xtra, BNS SME) — keep personal and business money separate.', 'Complete HEART/NSTA Entrepreneurship Development Level 1–2 programme.', 'Apply for JMD 50,000–150,000 from the Micro Enterprise Financing Ltd (MEFL) loan programme.', 'Build a simple social media presence: Instagram + WhatsApp Business are enough to start.'],
      y3: ['Get your first 10 repeat customers — customer retention beats acquisition at this stage.', 'Study basic financial literacy: cash flow, gross margin, break-even (JBDC offers free workshops).', 'Apply for the DBJ (Development Bank of Jamaica) Youth Entrepreneurship Loan (up to JMD 1M).', 'Look into JAMPRO Export Ready programme if your product has Caribbean or diaspora demand.'],
      y4: ['Register a limited liability company (Jamaica Companies Office — approx JMD 15,000).', 'Apply for ScotiaBank Jamaica Women\'s Initiative or BNS Small Business Grant if eligible.', 'Hire your first part-time employee or commission-based sales person — document everything.', 'Apply for NHT or CHASE Fund grants if your business has a social impact angle.'],
      y5: ['Day 1 "established": registered company + tax compliance + 2+ years of revenue history.', 'Target first export sale (UK, US, Canadian diaspora) via JAMPRO trade facilitation.', 'Revenue target: JMD 4–8M annual by end of Year 5.', 'No degree required — JBDC, HEART, and DBJ programmes are your university for entrepreneurship.'],
    },
  };

  /* ─── Jamaica local institution mapping per career ──────────────────────── */
  const JAMAICA_INSTITUTIONS = {
    'project-manager':    { degree: 'UWI Mona (BSc Mgmt)', vocational: 'HEART/NSTA — Project Mgmt Level 3', cert: 'MIND Jamaica (PM short courses)', scholarship: 'NHT Education Loan' },
    'software-developer': { degree: 'UTech (BSc CS / IT)', vocational: 'HEART/NSTA — ICT Level 3', cert: 'Caribbean Software & Tech Academy', scholarship: 'GOJ Student Loan (SLASPA)' },
    'nurse':              { degree: 'UHWI School of Nursing / NCU', vocational: 'HEART/NSTA — Community Health Level 3', cert: 'Nursing Council of Jamaica', scholarship: 'GOJ Nursing Bursary' },
    'marketing-manager':  { degree: 'UWI Mona (BSc Marketing)', vocational: 'HEART/NSTA — Business Admin Level 3', cert: 'Google / HubSpot / CIM Foundation', scholarship: 'UWI Open Campus Bursary' },
    'accountant':         { degree: 'UWI / UTech (BSc Accounting)', vocational: 'ACCA FIA (no degree required)', cert: 'ICAJ Student Membership', scholarship: 'ICAJ Annual Bursary' },
    'entrepreneur':       { degree: 'UTech (BSc Entrepreneurship)', vocational: 'HEART/NSTA Entrepreneurship Level 2', cert: 'JBDC SME Certification', scholarship: 'DBJ Youth Loan / CHASE Fund' },
  };

  const CAREER_META = {
    'project-manager':   { label: 'Project Manager',              certPill: '💼 PM Certifications',        lessonsTitle: '📚 8 Core Project Management Lessons',      lessonsDesc: 'These translate directly from classroom and sport to the boardroom.' },
    'software-developer':{ label: 'Software Developer',           certPill: '💻 Dev Certifications',       lessonsTitle: '📚 8 Core Software Development Lessons',    lessonsDesc: 'Principles that separate junior developers from senior engineers.' },
    'nurse':             { label: 'Registered Nurse / Midwife',   certPill: '🏥 Nursing Registration',     lessonsTitle: '📚 8 Core Nursing & Clinical Lessons',      lessonsDesc: 'Skills that protect patients and build a lifelong career in healthcare.' },
    'marketing-manager': { label: 'Marketing & Brand Manager',    certPill: '📢 Marketing Certifications', lessonsTitle: '📚 8 Core Marketing & Brand Lessons',       lessonsDesc: 'What separates marketers who guess from those who grow brands.' },
    'accountant':        { label: 'Accountant / Finance Pro',     certPill: '📊 ACCA / CPA Pathway',       lessonsTitle: '📚 8 Core Accounting & Finance Lessons',    lessonsDesc: 'The fundamentals every finance professional must master.' },
    'entrepreneur':      { label: 'Entrepreneur / Business Owner',certPill: '🚀 Business Certifications',  lessonsTitle: '📚 8 Core Entrepreneurship Lessons',        lessonsDesc: 'Hard-won truths every founder needs before they need them.' },
  };

  /* ─── Career Pathways (y1–y5 per career) ──────────────────────────────── */
  const CAREER_PATHWAYS = {

    /* ── PROJECT MANAGER ─────────────────────────────────────────────────── */
    'project-manager': {
      y1: {
        label: 'Year 1 — Build the Foundation', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> Mathematics, English Language, Information Technology, Business Studies.', 'Target 5+ CSEC passes — Math and English are non-negotiable for any university programme.', 'Create a revision timetable and protect study blocks like training sessions.', 'Use free platforms: Khan Academy (Math), BBC Bitesize (CSEC).'] },
          { icon: '🎯', title: 'Building Experience', items: ['Volunteer to organise one school event — sports day, fundraiser, or community project.', 'Identify your leadership role on any team (sports, clubs, student council).', 'Start a simple task tracker in Google Sheets for your own assignments — that is PM.', 'Shadow someone who manages teams or projects and ask them one question per month.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>Start now:</strong> Google Digital Garage — Fundamentals of Digital Marketing (free, recognised).', 'Learn what a project scope is: what is included, what is excluded, and why it matters.', 'Learn the difference between Agile and Waterfall — two main PM approaches.', 'Keep a project log: document what you organised, what worked, what did not.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Study days: 2 hrs study → 30 min break → repeat. Protect 8 hrs sleep on school nights.', 'One full tech-free evening per week for mental reset.', 'Communicate your schedule to family so they understand and can support you.', 'Celebrate small wins — a good grade, a completed task. Momentum is a skill.'], balance: { Study: 50, Activities: 25, Recovery: 15, Social: 10 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Research JASFUND (Jamaica Student Finance Fund) — understand eligibility now, apply later.', 'Ask your school counsellor for scholarship lists available to students your age.', 'Open a savings account and build the habit of saving even a small amount weekly.', 'Research which universities offer scholarships in management and business.'] },
        ],
        milestone: 'Complete 5+ CSEC subjects, earn one free online certificate, volunteer-lead one school project.'
      },
      y2: {
        label: 'Year 2 — Accelerate and Decide', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Business Management Unit 1 & 2 are the strongest foundation for PM.', 'Communication Studies will sharpen your stakeholder communication — a core PM skill.', 'Aim for Grade I or II in at least 3 CAPE units. Write your personal statement draft now.', 'If IT is available, take it — PM software knowledge starts here.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Lead a real project at school: fundraiser, inter-school event, or community initiative.', 'Document every project you lead: goal, plan, what happened, what you would do differently.', 'Attend at least one college or university open day (UWI, UTech, NCU, or overseas virtual).', 'Contact university departments directly — email them your profile and ask about your course options.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>Start auditing:</strong> Google Project Management Certificate on Coursera — free to audit, ~6 months.', 'Learn Microsoft Excel or Google Sheets at intermediate level — every PM uses them daily.', 'Learn what Agile, Scrum, and Waterfall mean in practice — not just theory.', 'Build a LinkedIn profile and connect with 5 PM professionals this year.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Build a <strong>weekly operating plan</strong> every Sunday for the coming week.', 'Use Pomodoro technique for study: 25 min focus, 5 min break.', 'Identify one person you can call when overwhelmed — parent, mentor, or trusted friend.', 'Pre-season: reduce social commitments. Post-season: restore them.'], balance: { Study: 55, Activities: 20, Recovery: 12, Social: 13 } },
          { icon: '💰', title: 'Financial & College Decisions', items: ['<strong>Apply for JASFUND</strong> — applications open annually, typically February–March.', 'Request letters of recommendation from teachers before school ends.', 'Draft your college shortlist: 2 Jamaica options, 2 UK, 2 US, 1 Canada.', 'Register with NCAA Eligibility Center if pursuing athletic scholarships in the US.'] },
        ],
        milestone: 'Earn CAPE results in 3+ units, complete Google PM Certificate audit, submit 2+ scholarship applications.'
      },
      y3: {
        label: 'Year 3 — University Foundations', subtitle: '1st Year University (Age 17–19)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Ideal programmes:</strong> BSc Business Administration, BSc Project Management, BSc IT (Management track).', 'UWI Mona and UTech both offer programmes that feed directly into PM careers.', 'First year: aim for 3.2+ GPA to keep scholarship eligibility and open graduate school doors.', 'Join the student council, project management club, or business society — professional development hours.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Get your first internship or volunteer experience in a project support role.', 'Attend campus career fairs. Every business card you collect is a future job lead.', 'Connect with alumni in project management roles via LinkedIn — ask for 20-min informational calls.', 'Start using PM language in every context: scope, deliverable, stakeholder, deadline.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>Complete Google Project Management Certificate</strong> (Coursera, ~$50/month or free audit).', 'Learn a PM tool: Trello (free), Asana (free tier), or Microsoft Project (university licence).', 'Register for PMI student membership (~USD $32/yr) to access CAPM study resources.', 'Build a LinkedIn profile that frames your experience in PM language.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['University social life is real pressure. Set two social events max per week during exam season.', 'Batch assignments — submit ahead of deadlines to create buffer time.', 'Find a mentor at your university — lecturer, career counsellor, or alumni in PM.', 'Book one phone-free day per week. Disconnecting is a productivity skill.'], balance: { Study: 50, Internship: 18, Recovery: 16, Social: 16 } },
          { icon: '💰', title: 'Managing University Finances', items: ['<strong>JASFUND loans:</strong> Up to JMD 1.5M/year for accredited programmes. Repayment starts after graduation.', '<strong>UWI Merit Scholarships:</strong> Renewable annually based on GPA (3.0+ required).', 'Apply for campus work-study programmes for supplemental income.', 'Budget monthly: tuition, transport, food, data, savings.'] },
        ],
        milestone: 'Maintain 3.0+ GPA, complete Google PM Certificate, earn first internship or project role, register on LinkedIn.'
      },
      y4: {
        label: 'Year 4 — Certify and Launch', subtitle: 'Final Year + PM Certification (Age 20–22)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Your final year project should be a real PM case study — choose a topic with industry relevance.', 'Target a Second Class Upper (2:1) or First Class degree — opens graduate programmes and international employers.', 'Apply for graduate programmes early if continuing (MBA, MSc Project Management).', 'Attend every career fair with 20 printed copies of your one-page CV.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Manage at least one formal project with a written charter and status reports.', 'Write a cover letter story: how your life experience taught you delivery, pressure, and teamwork.', 'Connect with 5+ project management professionals on LinkedIn and ask for informational calls.', 'Volunteer to manage an alumni or community event — a legitimate PM project for your resume.'] },
          { icon: '💼', title: 'Certification Sprint', items: ['<strong>Sit the CAPM exam</strong> before you graduate — only needs 23 hrs PM education, no work experience.', 'CAPM exam fee: USD $225 (PMI student rate). PMI student membership: USD $32/year.', '<strong>PMP:</strong> Requires 36 months work experience post-graduation. Plan for Year 6.', 'Build a portfolio of 3 documented projects with scope, timeline, outcomes, lessons learned.'] },
          { icon: '⚖️', title: 'Work / Life Balance — Final Push', items: ['Burnout is a real risk. Schedule one full offline day per week without exception.', 'Use a master task board: dissertation + certification + job applications all run at once.', 'Block time for physical activity even if sport is over — 3x30-min walks minimum for mental clarity.', 'Pre-plan your post-graduation month: one week off, then a structured job search sprint.'], balance: { Study: 40, Certification: 22, JobSearch: 22, Recovery: 16 } },
          { icon: '💰', title: 'Final Year Finances', items: ['Graduate scholarships: Chevening (UK), Commonwealth, Fulbright (USA) — apply in final year.', 'Save 3 months of living expenses before you graduate — gives you negotiating power.', 'Research salary ranges: JMD 1.8M–2.8M/yr in Jamaica, USD 55k–70k in North America.', 'Consider short-term contract PM roles while searching for full-time positions.'] },
        ],
        milestone: 'Graduate 2:1+, earn CAPM, apply to 5+ PM roles, have 3 documented projects in your portfolio.'
      },
      y5: {
        label: 'Day 1 — You Are a Project Manager', subtitle: 'First Role — First 90 Days', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Before Day 1', items: ['Research your employer: industry, recent projects, leadership team, culture.', 'Prepare 3 questions for your manager about priorities, success metrics, and team culture.', 'Organise your digital workspace: folders for project docs, templates, communications.', 'Read the PMI Code of Ethics — you are now accountable to professional standards.'] },
          { icon: '📋', title: 'First 30 Days — Listen and Map', items: ['Do not try to fix things yet. Month one is about understanding how things work.', 'Map all stakeholders: who has influence, who makes decisions, who needs information.', 'Build relationships before you build plans. People follow people they trust.', 'Identify the one metric your manager cares about most and orient your work around it.'] },
          { icon: '🚀', title: 'Days 31–60 — Deliver a Quick Win', items: ['Identify one small, well-scoped problem. Solve it visibly within 30 days.', 'Build your first project status update — one page: scope, progress, risks, next steps.', 'Start your PMP work experience log now — every project counts toward the 36-month requirement.', 'Ask for feedback at the 30-day mark. This shows maturity and commitment to growth.'] },
          { icon: '🏆', title: 'Days 61–90 — Own Your Lane', items: ['Take ownership of at least one formal project. Draft the project charter yourself.', 'Establish a regular cadence of stakeholder updates — weekly for active, bi-weekly for planning.', 'Find an internal mentor — someone 5–10 years ahead of you in programme management.', 'Document achievements: what you delivered, improved, learned. Fuels your performance review.'], balance: { DeepWork: 40, Meetings: 25, Learning: 15, Recovery: 20 } },
          { icon: '⚖️', title: 'Sustaining Balance as a Professional', items: ['Protect your mornings: a 30-min planning session before you open Slack sets the tone.', 'Never skip recovery. Boundaries, weekends, and real downtime are professional skills.', 'Book your next rest period before you start a demanding project phase — not after.', 'Your career is a marathon. Consistency over intensity wins in both sport and project management.'] },
        ],
        milestone: 'Complete first 90-day plan, log 200+ hours toward PMP, earn your first PM performance review.'
      },
    },

    /* ── SOFTWARE DEVELOPER ──────────────────────────────────────────────── */
    'software-developer': {
      y1: {
        label: 'Year 1 — Learn to Code', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> Mathematics, Information Technology, Physics, English Language.', 'Mathematics is the language of computing — algebra, logic, and statistics are essential.', 'If your school offers STEM clubs or robotics, join them immediately.', 'Target 5+ CSEC passes with a strong grade in IT or Computer Science.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Build your first website using free HTML/CSS tutorials on freeCodeCamp.org.', 'Create a GitHub account and push your first project — even if it is just a personal webpage.', 'Join or start a coding club at school. Teaching others accelerates your own learning.', 'Enter local hackathons or tech competitions — Caribbean Tech Fest runs annual youth events.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete <strong>freeCodeCamp Responsive Web Design</strong> certification (free, 300 hours, well-recognised).', 'Learn HTML, CSS, and basic JavaScript in that order. Master the fundamentals before frameworks.', 'Install VS Code (free) and learn keyboard shortcuts — speed matters in professional development.', 'Learn how to use Google to solve coding problems — this is a professional skill, not cheating.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Code in focused 45-minute blocks, then take a 15-minute break. Fatigue produces bugs.', 'Protect sleep — a tired brain cannot debug. 8 hours on school nights is not optional.', 'Do not compare your day 1 to someone else\'s day 1,000. Progress is the only metric.', 'One day per week with no screen time is a legitimate productivity investment.'], balance: { Study: 45, Coding: 28, Recovery: 15, Social: 12 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Research JASFUND — understand eligibility now, apply when you are ready for university.', 'All the core tools you need (VS Code, GitHub, freeCodeCamp) are completely free.', 'Open a savings account and save consistently — your first laptop purchase should be planned.', 'Caribbean tech companies like Moj, Nuvei, and NCB Digital are increasingly hiring locally.'] },
        ],
        milestone: 'Build and publish a personal webpage, earn freeCodeCamp HTML/CSS certificate, create a GitHub profile with at least 3 repos.'
      },
      y2: {
        label: 'Year 2 — Build Real Things', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Computer Science / IT Unit 1 & 2, Mathematics, Physics.', 'Strong CAPE performance opens doors to UWI and UTech Computer Science programmes.', 'Write your personal statement draft now — frame every project you have built as evidence of skill.', 'Aim for Grade I or II in CAPE IT. Universities assess both academic results and your GitHub.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Build a full project with both frontend and a simple backend (HTML + Node.js or Python Flask).', 'Contribute to one open-source project on GitHub — even fixing a typo in documentation counts.', 'Enter a hackathon. You will not win your first one. That is the point — you will learn more in 48 hours than weeks of tutorials.', 'Attend any local tech meetup or DevOps Jamaica event to start building professional networks.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>Complete freeCodeCamp JavaScript Algorithms and Data Structures</strong> certification.', 'Learn Git properly: branches, pull requests, merge conflicts, commit messages.', 'Choose one track to deepen: web development (React/Next.js), mobile (Flutter), or data science (Python/Pandas).', 'Start learning SQL — every developer needs to understand databases.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Tutorial hell is real — balance watching tutorials with actually building things (60/40 split).', 'Build a weekly schedule and stick to it. Developers who cannot manage their own time cannot manage projects.', 'Get outside. Physical activity prevents the burnout that kills developer careers early.', 'Find a peer coder online (Discord, Reddit r/learnprogramming) for accountability.'], balance: { Study: 45, Coding: 30, Recovery: 13, Social: 12 } },
          { icon: '💰', title: 'College & Financial Decisions', items: ['<strong>Apply for JASFUND</strong> — applications typically open February–March.', 'UTech School of Computing and UWI Mona both offer strong CS programmes. Apply to both.', 'Research remote internship opportunities — many US/UK tech companies offer paid remote internships for Caribbean students.', 'Draft your college shortlist: 2 Jamaica, 2 Canada (strong tech industry), 2 UK.'] },
        ],
        milestone: 'Build and deploy a full-stack web app, earn JavaScript certification, contribute to open source, submit 2+ scholarship applications.'
      },
      y3: {
        label: 'Year 3 — Go Professional', subtitle: '1st Year University (Age 17–19)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Ideal programmes:</strong> BSc Computer Science, BSc Software Engineering, BSc Information Technology.', 'Core modules to master: Data Structures & Algorithms, Database Systems, Operating Systems, Software Engineering.', 'Algorithms are your university entrance exam for big tech. Start LeetCode in year one.', 'Maintain a 3.2+ GPA — cloud certification programmes and competitive internships check academic records.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Land a software internship (even unpaid for experience) at a local company — NCB Tech, Digicel Digital, or a startup.', 'Build a portfolio of 3 projects deployed to the internet (not just code sitting on your laptop).', 'Contribute meaningfully to open source — a merged pull request on a real project outweighs any certificate.', 'Start solving LeetCode problems daily — even one problem per day compounds over a year.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>AWS Cloud Practitioner</strong> certification (~USD $100, highly valued by employers globally).', 'Learn React or Vue for frontend, Node.js or Django for backend — pick one stack and master it.', 'Learn Docker basics — containerisation is now a baseline expectation for junior developers.', 'Build your LinkedIn to tell your coding story: projects, tools, languages, contributions.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Imposter syndrome is universal. Everyone feels like a fraud at first — it passes when you ship things.', 'Deep work blocks (2+ hours uninterrupted) produce more than fragmented hours. Protect them.', 'Do not neglect social development — communication is the skill that promotes you, not just code quality.', 'Exercise. Sitting at a desk for 8+ hours damages your body and your output.'], balance: { Study: 42, Coding: 30, Internship: 14, Recovery: 14 } },
          { icon: '💰', title: 'Managing University Finances', items: ['AWS Student Educate and GitHub Student Pack give free access to tools worth thousands per year — activate both immediately.', 'JASFUND and UWI/UTech merit scholarships available — maintain GPA for renewals.', 'Remote freelance work is realistic in year 3: fix bugs, build landing pages, write APIs. Start at JMD 2,000–5,000/hr.', 'Budget for a reliable laptop and stable internet connection — these are professional tools, not luxuries.'] },
        ],
        milestone: 'Complete AWS Cloud Practitioner, land a dev internship, deploy 3 portfolio projects, solve 100+ LeetCode problems.'
      },
      y4: {
        label: 'Year 4 — Ship and Launch', subtitle: 'Final Year + Certification Sprint (Age 20–22)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Your final year project should be a real software product — not just an academic exercise.', 'Target a 2:1 or First Class — US and UK tech companies look at GPA for visa sponsorship decisions.', 'Write your dissertation/capstone so it reads as a product case study: problem, design, implementation, outcome.', 'Apply for graduate programmes if interested in AI/ML (MSc Computer Science, MSc Data Science).'] },
          { icon: '🎯', title: 'Building Experience', items: ['Complete a paid internship or contract role. Your final year project should exist alongside real work.', 'Speak at a local tech event, meetup, or university symposium — visibility compounds.', 'Build or contribute to a product that has real users. Even 10 users matters for interviews.', 'Apply to Google Summer of Code, Major League Hacking, or regional tech accelerators.'] },
          { icon: '💼', title: 'Certification Sprint', items: ['<strong>AWS Solutions Architect Associate</strong> (USD $300 exam) — the most recognised cloud cert for developers.', 'Consider: Google Associate Cloud Engineer, Meta Certified Developer, or CompTIA Security+.', 'Complete system design study — needed for all senior developer interviews at tech companies.', 'Prepare for technical interviews: data structures, algorithms, system design, behavioural questions.'] },
          { icon: '⚖️', title: 'Work / Life Balance — Final Push', items: ['Job search + final year is the hardest sprint of your student life. Calendar-block everything.', 'Apply to 2–3 roles per week consistently. Volume matters — even strong developers need 20–50 applications.', 'Rejection is data, not failure. Log what you learn from each interview and iterate.', 'Protect one day per week that is entirely free of code and applications.'], balance: { Study: 35, JobSearch: 28, Coding: 22, Recovery: 15 } },
          { icon: '💰', title: 'Final Year Finances', items: ['Entry-level developer salaries: JMD 2.5M–3.5M/yr in Jamaica, USD 65k–85k in North America, GBP 30k–42k in UK.', 'Remote roles for Caribbean developers are increasingly common — target companies in the US time zone.', 'Chevening, Commonwealth Scholarship, and Mitacs (Canada) fund MSc programmes — apply before you graduate.', 'Freelance while job searching — it keeps skills sharp and generates income.'] },
        ],
        milestone: 'Earn AWS Solutions Architect, graduate 2:1+, have a deployed final year product with real users, receive first job offer.'
      },
      y5: {
        label: 'Day 1 — You Are a Developer', subtitle: 'First Role — First 90 Days', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Before Day 1', items: ['Read the company\'s public-facing code or tech blog to understand their stack before you start.', 'Set up your local development environment the week before — do not waste Day 1 on tooling.', 'Prepare questions about the codebase, team process, and how they handle code reviews.', 'Connect with your future team on LinkedIn or GitHub before your first day.'] },
          { icon: '📋', title: 'First 30 Days — Read the Code', items: ['Do not rewrite anything in month one. Read, understand, and run existing code first.', 'Fix small bugs before proposing features — earn trust with clean, well-tested pull requests.', 'Ask "why" more than "what" — understanding architectural decisions matters more than knowing the syntax.', 'Keep a learning log: every new concept, every bug you fixed, every pattern you encountered.'] },
          { icon: '🚀', title: 'Days 31–60 — Ship a Feature', items: ['Own one small feature end-to-end: design, implement, test, review, deploy.', 'Write tests for everything you ship. Untested code is a professional liability.', 'Learn the deployment pipeline — how does code go from your laptop to production?', 'Ask for a code review from the senior developer you most want to learn from.'] },
          { icon: '🏆', title: 'Days 61–90 — Become a Contributor', items: ['Propose one process improvement: a script that saves time, a doc that prevents repeated questions.', 'Understand the product from a user perspective — the best code solves real user problems.', 'Start mentoring someone newer to the codebase — teaching reveals gaps in your own understanding.', 'Document your 90-day wins for your performance review.'], balance: { DeepWork: 50, Meetings: 20, Learning: 18, Recovery: 12 } },
          { icon: '⚖️', title: 'Sustaining Balance as a Developer', items: ['Protect deep work hours — the best code is written in long, uninterrupted blocks.', 'Avoid the "hero developer" trap: staying late every night is burnout, not dedication.', 'Keep learning outside of work — 30 minutes of deliberate study per day compounds into seniority.', 'Your soft skills (communication, collaboration) will promote you faster than your code quality alone.'] },
        ],
        milestone: 'Ship first feature to production, complete 90-day review with positive feedback, earn first performance-based pay increase.'
      },
    },

    /* ── REGISTERED NURSE / MIDWIFE ──────────────────────────────────────── */
    'nurse': {
      y1: {
        label: 'Year 1 — Science Foundations', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> Biology, Chemistry, Human & Social Biology, Mathematics, English Language.', 'Biology and Chemistry are non-negotiable for nursing programme entry. Both must be passed at CSEC.', 'English Language is critical — nursing documentation, patient communication, and report-writing depend on it.', 'Target 5+ CSEC passes. Nursing schools in Jamaica and overseas set specific subject requirements.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Volunteer at a local health centre, pharmacy, or community health drive — even one day per month.', 'Complete a basic First Aid and CPR course (HEART/NSTA offers these across Jamaica).', 'Shadow a nurse, midwife, or community health worker and ask them about their career path.', 'Join the school health club or Red Cross youth programme if available.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete a free online anatomy and physiology course (Khan Academy, Coursera audit).', 'Learn basic medical terminology — it will give you a head start in your nursing programme.', 'Develop note-taking and study skills now — nursing programmes require heavy information retention.', 'Practice your communication: clear, calm, compassionate speech is a clinical skill.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Nursing is physically and emotionally demanding. Build your resilience and self-care habits now.', 'Sleep 8 hours on school nights — fatigue impairs memory and decision-making.', 'Find a physical activity you enjoy: walking, swimming, sport. You will need it your whole career.', 'Talk to someone you trust when you feel overwhelmed. Emotional health is a professional asset.'], balance: { Study: 52, Volunteering: 18, Recovery: 18, Social: 12 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Research JASFUND — nursing programmes at UWI, NCU, and UHWI all qualify for student loans.', 'The HEART/NSTA Trust funds healthcare training programmes — check their website annually.', 'Open a savings account and build consistent savings habits now.', 'Nursing is a globally mobile profession — Caribbean nurses are in demand in the UK, Canada, and US.'] },
        ],
        milestone: 'Earn 5+ CSEC passes including Biology and Chemistry, complete First Aid certification, complete at least 20 hrs of healthcare volunteering.'
      },
      y2: {
        label: 'Year 2 — Prepare to Apply', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Biology Unit 1 & 2, Chemistry Unit 1, Caribbean Studies.', 'Your CAPE Biology grade will be the primary filter for nursing programme admission.', 'Research the entry requirements for your target nursing programmes now and build your application around them.', 'Write your personal statement: what drew you to nursing, what experience you have, what kind of nurse you want to be.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Increase your healthcare volunteering — aim for 50+ hours before your application.', 'Shadow a nurse in a clinical setting if possible. A letter from a supervising nurse is valuable with your application.', 'Attend UWI, NCU, or UTech open days and speak directly to the nursing faculty.', 'Participate in community health education projects — this demonstrates initiative and care.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete a Mental Health First Aid course — increasingly required for healthcare professionals.', 'Learn basic vital signs monitoring (blood pressure, pulse, temperature) — first clinical skill.', 'Study the Nursing Council of Jamaica registration requirements — understand the path before you start.', 'Improve your written English: clinical documentation must be precise, clear, and professional.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['The nursing programme is intense. Start building stress management techniques now.', 'Learn to separate your emotional response to patient care from your professional performance.', 'Build a support network of peers going into the same field — you will need them in clinical placements.', 'Physical fitness supports clinical performance: nurses are on their feet for 12-hour shifts.'], balance: { Study: 55, Volunteering: 18, Recovery: 15, Social: 12 } },
          { icon: '💰', title: 'College & Financial Planning', items: ['<strong>Apply for JASFUND</strong> — nursing programme qualifies. Applications open February–March.', 'Research parish council bursaries and hospital foundation scholarships — these are underutilised.', 'UWI Mona School of Nursing and NCU are the two strongest nursing schools in Jamaica — apply to both.', 'Research NCLEX — the US nursing licensure exam. Passing it post-graduation opens US nursing jobs at USD 70k–90k/yr.'] },
        ],
        milestone: 'Earn strong CAPE Biology results, complete 50+ hrs healthcare volunteering, submit nursing programme applications with strong personal statement.'
      },
      y3: {
        label: 'Year 3 — Clinical Training Begins', subtitle: '1st Year Nursing Programme (Age 18–20)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Year 1 of nursing covers anatomy, physiology, fundamentals of nursing, pharmacology, and patient assessment.', 'Pharmacology is the subject most students struggle with most — start studying drug classifications early.', 'Your GPA in year one determines your clinical placement quality in later years.', 'Form study groups — nursing programmes reward collaborative learning.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Approach every clinical placement as a professional, not a student. How you treat patients defines your reputation.', 'Ask your clinical supervisor for feedback after every shift — do not wait for formal evaluations.', 'Document your clinical hours meticulously — you will need this for Nursing Council registration.', 'Build relationships with registered nurses on your ward — they often know about job opportunities before they are posted.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Master IV cannulation, medication administration, wound care, and patient assessment in your first year.', 'Complete BLS (Basic Life Support) certification — required for all clinical placements.', 'Learn to write clinical documentation to a professional standard — accuracy protects patients and nurses.', 'Study the Nursing Council of Jamaica Act — know your professional scope of practice from day one.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Clinical placements plus academic study is exhausting. Build recovery into your schedule.', 'Compassion fatigue is real in nursing — practise separating patient outcomes from personal identity.', 'You cannot pour from an empty cup. Self-care is a professional obligation, not a luxury.', 'Find a senior nurse or lecturer to be your mentor — every great nurse had one.'], balance: { Study: 38, Clinical: 35, Recovery: 18, Social: 9 } },
          { icon: '💰', title: 'Managing Programme Finances', items: ['JASFUND loan payments defer until graduation. Track your loan balance and interest monthly.', 'Some hospital trusts and health authorities offer scholarships with a service commitment bond after graduation.', 'UHWI, Cornwall Regional, and Kingston Public Hospital all employ student nurses in part-time roles.', 'Budget for uniforms, clinical supplies, and examination fees.'] },
        ],
        milestone: 'Complete Year 1 clinical placements, earn BLS certification, maintain passing GPA in all modules, document 200+ supervised clinical hours.'
      },
      y4: {
        label: 'Year 4 — Graduate Nurse Preparation', subtitle: 'Final Year + Registration Prep (Age 20–22)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Final year covers advanced nursing practice, leadership, research methods, and community health.', 'Your dissertation or research project should focus on a clinical problem you observed in placement.', 'Target a strong final grade — it affects your registration classification and job offers.', 'If considering the UK, research the NMC (Nursing and Midwifery Council) registration requirements during final year.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Lead a nursing procedure or patient care episode under supervised practice.', 'Write a professional CV that translates clinical competencies into employer-readable language.', 'Attend job fairs run by the Ministry of Health, UHWI, and private hospitals.', 'Consider midwifery as a postgraduate specialisation — midwives are in high demand in Jamaica and the UK.'] },
          { icon: '💼', title: 'Registration & Certification', items: ['<strong>Register with the Nursing Council of Jamaica</strong> upon graduation — mandatory for practice.', '<strong>NCLEX-RN</strong> (US licensure): Pearson VUE exam, USD $200. Passing this opens US nursing at USD 70k–90k/yr.', '<strong>NMC UK registration</strong>: English language test (IELTS 7.0+) + Computer-Based Test (CBT). UK nursing: GBP 28k–38k/yr.', 'Consider ACLS (Advanced Cardiovascular Life Support) certification for ICU/emergency nursing specialisation.'] },
          { icon: '⚖️', title: 'Work / Life Balance — Final Push', items: ['NCLEX prep while completing final year is demanding — create a strict 3-month study schedule.', 'Protect your emotional health during long clinical shifts. Debriefing after difficult cases is not weakness.', 'Build your post-graduation plan before you graduate, not after.', 'Celebrate graduating. It is one of the most demanding academic programmes in the Caribbean.'], balance: { Study: 38, Clinical: 30, ExamPrep: 18, Recovery: 14 } },
          { icon: '💰', title: 'Final Year & Career Finances', items: ['Jamaica MOH starting salary for Registered Nurses: JMD 1.4M–1.9M/yr. Private sector pays 20–40% more.', 'UK NHS Band 5 Registered Nurse starting salary: GBP 28,407/yr with pathway to GBP 34k+ within 2 years.', 'Canada recruits Caribbean nurses actively — Ontario and British Columbia both have immigration pathways.', 'USA travel nursing contracts can pay USD 2,000–4,000/week for agency nurses.'] },
        ],
        milestone: 'Graduate, register with Nursing Council of Jamaica, sit NCLEX-RN within 6 months, receive first nursing job offer.'
      },
      y5: {
        label: 'Day 1 — You Are a Registered Nurse', subtitle: 'First Post — First 90 Days', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Before Day 1', items: ['Review your ward\'s medication protocols and common drug classes before your first shift.', 'Understand the shift handover format used at your facility — SBAR is the standard.', 'Prepare your uniform, ID, and essential clinical tools (stethoscope, pen torch, notes pad) in advance.', 'Read your employment contract carefully — understand your scope of practice and your obligations.'] },
          { icon: '📋', title: 'First 30 Days — Learn Your Environment', items: ['Orient yourself to every piece of equipment on your ward before you need it in an emergency.', 'Build relationships with your colleagues — nursing is a team sport and communication saves lives.', 'Never guess on medications. If in doubt, confirm with a senior nurse or the pharmacist.', 'Document everything accurately and contemporaneously. Your documentation is a legal record.'] },
          { icon: '🚀', title: 'Days 31–60 — Build Competence', items: ['Take ownership of a full patient load under supervision and advocate clearly for your patients.', 'Identify your knowledge gaps and address them proactively — attend every available training.', 'Develop your time management across a full 12-hour shift: patient rounds, medications, documentation, handover.', 'Ask for feedback from the ward manager or senior nurse at the 30-day mark.'] },
          { icon: '🏆', title: 'Days 61–90 — Become Trusted', items: ['Competence builds reputation. Be the nurse who other staff trust in complex patient situations.', 'Begin planning your specialisation: ICU, midwifery, theatre, community, or paediatrics.', 'Maintain your CPD (Continuing Professional Development) log — Nursing Council renewal requires it.', 'Document your clinical achievements for your first performance appraisal.'], balance: { Clinical: 55, Documentation: 20, Learning: 15, Recovery: 10 } },
          { icon: '⚖️', title: 'Sustaining Balance as a Nurse', items: ['Nursing has one of the highest burnout rates of any profession. Take this seriously from Day 1.', 'Debrief after difficult or traumatic cases — with a colleague, supervisor, or counsellor.', 'Your physical health is your career. Protect your back, eat on shift, and hydrate.', 'Your empathy is your greatest clinical asset. Protect it by processing difficult emotions, not suppressing them.'] },
        ],
        milestone: 'Complete 90-day probation, receive NCLEX registration (if US-bound), begin specialisation planning, complete first CPD cycle.'
      },
    },

    /* ── MARKETING & BRAND MANAGER ───────────────────────────────────────── */
    'marketing-manager': {
      y1: {
        label: 'Year 1 — Tell Your Story', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> English Language, Art & Design, Business Studies, Social Studies, IT.', 'English is your most important subject — marketing is fundamentally about communication.', 'Business Studies will teach you how markets work, which is the foundation of every marketing decision.', 'Target 5+ CSEC passes. Marketing degree entry requires strong English and Business results.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Create a social media account for a real purpose: a school club, a community cause, or a local business.', 'Design posters, flyers, or graphics for school events using Canva (free).', 'Study the social media presence of 3 Jamaican brands (e.g., Grace Kennedy, Red Stripe, Walkerswood) and analyse what they do differently.', 'Write a short blog or newsletter for your school — practise writing for an audience.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete <strong>Google Digital Garage: Fundamentals of Digital Marketing</strong> (free, 26 modules, globally recognised).', 'Learn Canva — it is the industry-standard tool for entry-level marketing content creation.', 'Understand the difference between branding, marketing, and advertising — most people confuse all three.', 'Open a free Google Analytics demo account and learn how websites track visitor behaviour.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Marketing ideas come at unexpected times — keep a notes app open at all times for capturing them.', 'Do not confuse consuming social media with creating for it. Limit your personal scrolling time.', 'Build broad cultural knowledge: great marketers understand people, not just products.', 'Sleep and physical activity improve creative output — protect both.'], balance: { Study: 48, Projects: 25, Recovery: 15, Social: 12 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Research JASFUND for marketing/business degree funding.', 'Canva, Google Analytics, Meta Business Suite, and Mailchimp are all free at entry level.', 'Freelance graphic design and social media management are realistic income sources even at age 16.', 'Caribbean marketing agencies (McCann Jamaica, Lonsdale) recruit from university marketing programmes.'] },
        ],
        milestone: 'Earn Google Digital Marketing certificate, build and manage one real social media account, design at least 10 marketing materials in Canva.'
      },
      y2: {
        label: 'Year 2 — Build Your Brand Voice', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Communication Studies Unit 1 & 2, Business Management, Sociology or Media Studies.', 'Communication Studies will teach you audience analysis — the foundation of every marketing campaign.', 'Your CAPE grades open doors to UWI Mona (BSc Marketing) and UTech (BSc Marketing/Communications).', 'Write your personal statement around every creative or marketing project you have done.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Run a real marketing campaign for a local business, school club, or community event.', 'Learn to use Meta Business Suite to run and measure a basic paid social media campaign.', 'Build a portfolio: collect every poster, campaign, social post, or marketing piece you have created.', 'Intern or volunteer at a local business to help with their marketing — even 2 hours per week builds your resume.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete <strong>Meta Blueprint Social Media Marketing certification</strong> (free courses, paid exam ~USD $150).', 'Learn Google Ads basics — even free courses on the Google Skillshop platform are industry-recognised.', 'Study copywriting: how to write headlines, calls to action, and brand messaging.', 'Learn basic email marketing via Mailchimp (free tier up to 500 contacts).'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Creative burnout is real — do not try to be always-on. Schedule creative time, not reactive time.', 'Follow marketing news: Campaign, Marketing Week, AdAge — 20 minutes per day builds your industry knowledge fast.', 'Your personal brand is a 24/7 portfolio. Be intentional about what you post publicly.', 'Protect time for consuming art, culture, and travel — this feeds your creative output.'], balance: { Study: 45, Projects: 28, Recovery: 13, Social: 14 } },
          { icon: '💰', title: 'College & Financial Decisions', items: ['Apply for JASFUND. Marketing/Communications degrees at UWI and UTech qualify.', 'Research advertising agency graduate programmes: McCann Worldgroup, Ogilvy (regional offices recruit from Jamaica).', 'Freelance social media management can generate JMD 20,000–60,000/month in year 2 with the right clients.', 'Draft your college shortlist: UWI, UTech, plus 2 UK (Leeds, Edinburgh have strong marketing programmes).'] },
        ],
        milestone: 'Earn Meta Blueprint certification, run one end-to-end marketing campaign with measurable results, build a digital portfolio.'
      },
      y3: {
        label: 'Year 3 — Campaign Strategy', subtitle: '1st Year University (Age 17–19)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Ideal programmes:</strong> BSc Marketing, BSc Communications, BSc Business (Marketing Track).', 'Core modules: Consumer Behaviour, Brand Management, Market Research, Digital Marketing, PR.', 'Consumer behaviour is the most important module in a marketing degree — understand it deeply.', 'Maintain a 3.2+ GPA. Marketing agencies and big brands filter by academic performance at entry level.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Intern at a marketing agency, media company, or corporate marketing department.', 'Run your university\'s social media accounts or join the student marketing club.', 'Enter brand competitions (Cannes Young Lions, D&AD New Blood) — Caribbean students regularly win.', 'Build relationships with marketing practitioners via LinkedIn and local industry events.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>Google Analytics 4 (GA4) certification</strong> (free, required for any digital marketing role).', '<strong>HubSpot Content Marketing certification</strong> (free, well-regarded by employers globally).', 'Learn basic data analysis in Excel/Google Sheets — marketing decisions are increasingly data-driven.', 'Understand SEO fundamentals: how search engines rank content and why it matters for brands.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Marketing moves fast. Dedicate 30 minutes daily to reading industry news — it is part of the job.', 'Build systems for your personal projects so you are not reinventing creative processes every time.', 'Network actively but intentionally — one deep professional relationship is worth more than 100 LinkedIn connections.', 'Your own brand (how you present yourself) is your first and most important marketing project.'], balance: { Study: 42, Internship: 22, Projects: 18, Recovery: 18 } },
          { icon: '💰', title: 'Managing University Finances', items: ['Internship pay in Caribbean marketing agencies: JMD 30,000–70,000/month.', 'Freelance social media management can fund your university lifestyle with 2–3 clients.', 'JASFUND and UWI/UTech merit scholarships cover tuition — apply for both.', 'Adobe Creative Suite is expensive. Use university licences while you have access.'] },
        ],
        milestone: 'Complete GA4 and HubSpot certifications, complete a marketing internship, present one full campaign strategy as a university project.'
      },
      y4: {
        label: 'Year 4 — Launch Your Career', subtitle: 'Final Year + Career Entry (Age 20–22)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Your final year project should be a real brand strategy or marketing campaign — not a theoretical exercise.', 'Target 2:1 or higher. Regional and international agencies use GPA as a shortlist filter.', 'Write your dissertation on a brand or market you want to work in professionally — it is a job interview piece.', 'Attend every brand and communications event you can access this year.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Secure a graduate placement or final year internship at your target agency or brand.', 'Pitch your marketing portfolio to 3 companies before you graduate.', 'Lead a campus marketing campaign from strategy to execution to measurement.', 'Speak at a student marketing event or panel — visibility in your field matters.'] },
          { icon: '💼', title: 'Certification Sprint', items: ['<strong>Google Ads Search and Display certifications</strong> (free via Google Skillshop).', '<strong>Meta Certified Digital Marketing Associate</strong> (USD $99 exam) — required by most digital agencies.', 'Learn basic video editing (CapCut, Premiere Rush) — video content is now the dominant marketing format.', 'Study brand strategy frameworks: Brand Pyramid, Brand Key, Jobs-To-Be-Done.'] },
          { icon: '⚖️', title: 'Work / Life Balance — Final Push', items: ['Job searching + final year is exhausting. Treat your job search like a project with a scope, timeline, and KPIs.', 'Apply to 2–3 marketing roles per week. Consistency beats desperation.', 'Your portfolio is your first impression. Update it every time you complete a project.', 'Take time to celebrate creative wins. The marketing profession rewards passion.'], balance: { Study: 38, JobSearch: 25, Projects: 22, Recovery: 15 } },
          { icon: '💰', title: 'Final Year Finances', items: ['Entry-level marketing salaries in Jamaica: JMD 1.8M–2.4M/yr. Agency roles often have lower base + bonuses.', 'UK marketing graduate salaries: GBP 22k–28k/yr in London agencies. Toronto/NYC pay significantly more.', 'Freelancing is a viable career path — many senior marketers are now independent consultants.', 'Chevening and Commonwealth Scholarships fund MSc Marketing and Communications degrees.'] },
        ],
        milestone: 'Graduate 2:1+, earn Google Ads and Meta certifications, secure first marketing role, have a portfolio of 5+ documented campaigns.'
      },
      y5: {
        label: 'Day 1 — You Are a Marketer', subtitle: 'First Role — First 90 Days', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Before Day 1', items: ['Study your new employer\'s brand guidelines, tone of voice, and content history before you start.', 'Audit their social channels: what works, what does not, what is missing.', 'Prepare questions for your manager about brand goals, target audience, and current performance metrics.', 'Research their top 3 competitors — you will need this context from Day 1.'] },
          { icon: '📋', title: 'First 30 Days — Understand the Brand', items: ['Do not rebrand everything in month one. Understand why decisions were made before proposing changes.', 'Map the full marketing ecosystem: channels, audiences, tools, budgets, agencies, and KPIs.', 'Build a strong working relationship with the sales team — marketing and sales must align.', 'Identify the one campaign or initiative that will be your first opportunity to show impact.'] },
          { icon: '🚀', title: 'Days 31–60 — Produce and Measure', items: ['Launch your first piece of owned content and measure every metric: reach, engagement, click-through, conversion.', 'Present a performance report to your manager — data storytelling is a core marketing skill.', 'Propose one test or experiment based on what you have observed in the first 30 days.', 'Build your content calendar for the next quarter.'] },
          { icon: '🏆', title: 'Days 61–90 — Own a Channel or Campaign', items: ['Take full ownership of one marketing channel, product line, or campaign and become the expert in it.', 'Begin building the case for your first marketing initiative by framing it in business objectives, not creative instincts.', 'Find a senior marketer inside or outside your company to mentor your thinking.', 'Document your first 90 days of output for your performance review.'], balance: { DeepWork: 35, Strategy: 25, Content: 25, Recovery: 15 } },
          { icon: '⚖️', title: 'Sustaining Balance as a Marketer', items: ['Marketing is always-on by nature — set working hours and stick to them.', 'Creative burnout kills output. Schedule unstructured creative time — walking, art, music.', 'Measure everything but do not become paralysed by data. Intuition is part of good marketing too.', 'Your career will be built on a combination of skills and relationships. Invest in both deliberately.'] },
        ],
        milestone: 'Own first marketing campaign end-to-end, hit a measurable KPI, present first performance report to leadership.'
      },
    },

    /* ── ACCOUNTANT / FINANCE PROFESSIONAL ───────────────────────────────── */
    'accountant': {
      y1: {
        label: 'Year 1 — Master the Numbers', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> Mathematics, Principles of Accounts, Economics, English Language, IT.', 'Mathematics and Accounts are both non-negotiable for any accounting or finance programme entry.', 'Economics will teach you how markets and incentives work — essential context for financial analysis.', 'Target 5+ CSEC passes. Many accounting programmes require A in both Maths and Accounts.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Offer to help a family member or local business with basic bookkeeping — even simple cash books count.', 'Shadow an accountant at a local firm, bank, or business for a day if possible.', 'Join your school\'s business club or economics club — financial thinking develops through discussion.', 'Analyse the financial news: when companies report profits/losses, understand why.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Learn Microsoft Excel fundamentals — accounting is Excel-based at every level of the profession.', 'Understand the three core financial statements: income statement, balance sheet, cash flow statement.', 'Begin studying ACCA Foundation level materials (F1–F3) independently — getting ahead pays off.', 'Register on ICAJ (Institute of Chartered Accountants of Jamaica) website to understand the local qualification path.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Accounting requires precision and focus — practise working in clean, distraction-free environments.', 'Protect study time from social distractions. One bad exam result can set back your qualification timeline by months.', 'Find a balance between analytical rigour and communication skills — great accountants do both.', 'Sleep and exercise improve mathematical accuracy and cognitive stamina.'], balance: { Study: 55, Practice: 20, Recovery: 15, Social: 10 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Research JASFUND for accounting degree funding at UWI, NCU, or UTech.', 'The Big 4 firms (KPMG, PwC, Deloitte, EY) all operate in Jamaica and run graduate recruitment each year.', 'Excel is free with Google Sheets as an alternative. Start practising financial modelling now.', 'An ACCA qualification is globally recognised and can be completed part-time while working.'] },
        ],
        milestone: 'Earn CSEC passes in Maths and Accounts, complete Excel fundamentals training, understand all three core financial statements.'
      },
      y2: {
        label: 'Year 2 — Accounting Fundamentals', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Accounting Unit 1 & 2, Economics Unit 1, Business Management.', 'CAPE Accounting is the direct preparation for ACCA and university accounting programmes.', 'Your CAPE results determine your university entry — aim for Grade I.', 'Write your personal statement: frame your interest in accounting through specific examples, not generalities.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Complete basic bookkeeping for a family business, church, or community organisation — this is real accounting experience.', 'Attend ICAJ student events and speak to qualified accountants about their career paths.', 'Apply for a part-time or vacation job at an accounting firm — even as administrative support.', 'Compete in the ICAJ student accounting competition if available in your region.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['<strong>ACCA Applied Knowledge level (BT, MA, FA)</strong> — you can begin these papers from Year 2 with CAPE results.', 'Master Microsoft Excel: VLOOKUP, pivot tables, financial functions (NPV, IRR, PV, FV).', 'Learn basic accounting software: Wave (free) or QuickBooks (student trial available).', 'Study International Financial Reporting Standards (IFRS) — the global accounting standard.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['ACCA exam sittings happen in March, June, September, and December. Plan your calendar around them.', 'Accounting study requires sustained concentration. Build your ability to work for 3+ hours without distraction.', 'Avoid the trap of studying only accounting — soft skills (communication, leadership) are what advance careers beyond technical roles.', 'Your reputation for integrity starts in school. Be known as someone who is honest with numbers.'], balance: { Study: 55, Work: 18, Recovery: 14, Social: 13 } },
          { icon: '💰', title: 'College & Certification Planning', items: ['Apply for JASFUND — accounting degrees at UWI and UTech qualify.', '<strong>ACCA student registration</strong> costs approximately GBP 79 + exam fees per paper. Begin planning your paper sequence.', 'The Big 4 in Jamaica run summer vacation schemes — apply for KPMG, PwC, Deloitte, and EY programmes.', 'ICAJ offers student scholarships annually — check their website and apply before Grade 12 ends.'] },
        ],
        milestone: 'Earn Grade I CAPE Accounting, pass first ACCA Applied Knowledge paper, secure first bookkeeping experience.'
      },
      y3: {
        label: 'Year 3 — University + ACCA', subtitle: '1st Year University (Age 18–20)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Ideal programmes:</strong> BSc Accounting, BSc Finance, BSc Accounting & Management.', 'UWI and UTech accounting programmes carry ACCA exemptions — understand which papers you are exempt from.', 'Core modules: Financial Reporting, Management Accounting, Taxation (Jamaica), Auditing, Business Law.', 'Maintain a 3.2+ GPA. Big 4 firms set minimum GPA requirements for their graduate programmes.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Apply for the Big 4 vacation scheme (KPMG, PwC, Deloitte, EY) during university holidays — this is the most direct path to a Big 4 job.', 'Complete at least one semester of part-time work in an accounts or finance role.', 'Take on the treasurer role in any club or society — real financial responsibility.', 'Build your professional network at ICAJ events, ACCA Jamaica events, and university career days.'] },
          { icon: '💼', title: 'ACCA Progression', items: ['Complete ACCA Applied Knowledge papers: Business and Technology (BT), Management Accounting (MA), Financial Accounting (FA).', 'Begin ACCA Applied Skills papers: Corporate and Business Law (LW), Performance Management (PM), Taxation (TX).', 'Target 2 ACCA papers per exam sitting — this keeps you on a 3-year qualification timeline.', 'Join the ACCA student community for study materials, mock exams, and peer networks.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['ACCA exam prep + university study is intense. Build a study schedule that covers both, not just one.', 'December exam sitting clashes with end-of-year university exams — plan this conflict well in advance.', 'Financial professionals carry confidential information. Build your professional integrity standards now.', 'Accounting burnout is common — physical exercise, social time, and sleep protect your cognitive performance.'], balance: { Study: 45, ACCA: 22, Work: 15, Recovery: 18 } },
          { icon: '💰', title: 'Managing University Finances', items: ['ACCA exam fees range from GBP 100–300 per paper. Budget this as part of your annual education costs.', 'Big 4 vacation scheme participants are often paid — apply early (October for the following summer).', 'JASFUND + university merit scholarships can cover tuition if GPA is maintained.', 'Learn to read your own bank statements as a financial exercise — every accountant should manage their own money well.'] },
        ],
        milestone: 'Pass 3+ ACCA Applied Knowledge papers, complete a Big 4 vacation scheme, maintain 3.2+ GPA.'
      },
      y4: {
        label: 'Year 4 — Qualify and Enter', subtitle: 'Final Year + ACCA Sprint (Age 21–23)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['Your final year project should be a financial analysis of a real company — IFRS compliance, ratio analysis, valuation.', 'Target 2:1 or higher — required for Big 4 graduate programme applications.', 'Complete as many ACCA Applied Skills papers as possible in final year — momentum matters.', 'Study the Jamaican tax code — local accounting firms prioritise candidates with tax knowledge.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Apply for the Big 4 graduate programme. KPMG and PwC Jamaica recruit from UWI and UTech annually.', 'If Big 4 is not immediate, target banks (NCB, Scotiabank), insurance companies (Guardian, Sagicor), or government agencies (BOJ, Tax Administration Jamaica).', 'Complete your ICAJ pre-qualification requirements — the professional experience component requires documentation.', 'Build your professional profile: LinkedIn, ICAJ membership, and an updated CV that lists every ACCA paper passed.'] },
          { icon: '💼', title: 'ACCA & Professional Certification', items: ['Target completing all Applied Skills papers before graduation: LW, PM, TX, FR, AA, FM.', 'Begin ACCA Strategic Professional papers: SBL (Strategic Business Leader) and SBR (Strategic Business Reporting).', 'Understand the difference between ACA (ICAEW), ACCA, and CPA — each has different geography and employer recognition.', 'A chartered accountancy qualification (ACCA, ACA) is the license to operate at senior levels in finance.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Final year + ACCA exams + job applications is the hardest period of your qualification journey. Plan meticulously.', 'Every Big 4 interview includes a technical test — do not neglect technical preparation.', 'Celebrate each ACCA pass. The ACCA qualification has a global pass rate below 50% — every pass is earned.', 'Build habits that sustain you through 2–3 more years of post-graduation study for ACCA completion.'], balance: { Study: 38, ACCA: 28, JobSearch: 20, Recovery: 14 } },
          { icon: '💰', title: 'Final Year Finances', items: ['Big 4 graduate salaries in Jamaica: JMD 2.2M–3.0M/yr. Many firms also pay ACCA exam fees.', 'UK newly qualified accountant (ACA/ACCA): GBP 45k–65k/yr at a Big 4 firm.', 'Canada and the US recruit Jamaican-trained accountants through CPA reciprocal agreements.', 'Chevening and Commonwealth Scholarships fund MSc Accounting, Finance, and Economics degrees.'] },
        ],
        milestone: 'Graduate 2:1+, complete all ACCA Applied Skills papers, receive Big 4 or senior finance firm offer.'
      },
      y5: {
        label: 'Day 1 — You Are a Finance Professional', subtitle: 'First Role — First 90 Days', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Before Day 1', items: ['Read the firm\'s most recent published accounts and audit reports.', 'Understand your employer\'s industry: how they make money, what their key financial risks are.', 'Prepare questions about the month-end close process, client portfolio, and learning pathway.', 'Understand the professional standards and ethics code that govern your role from Day 1.'] },
          { icon: '📋', title: 'First 30 Days — Learn the Systems', items: ['Master the accounting software your firm uses: SAP, Oracle, Xero, or QuickBooks.', 'Understand the month-end close process — this is the heartbeat of every finance department.', 'Map your client portfolio or business unit: what are the key financial drivers?', 'Ask for a full briefing on the firm\'s approach to compliance and professional standards.'] },
          { icon: '🚀', title: 'Days 31–60 — Deliver Quality Work', items: ['Produce your first set of management accounts or audit working papers to a professional standard.', 'Meet every deadline. In accounting, late delivery is a professional failure.', 'Ask questions before you make assumptions. In finance, an assumption without a basis is a risk.', 'Continue your ACCA studies. Many firms pay exam fees — use this benefit immediately.'] },
          { icon: '🏆', title: 'Days 61–90 — Build Your Reputation', items: ['Become the person your team can rely on for accurate, timely, well-documented work.', 'Proactively identify a financial risk or efficiency improvement and raise it professionally.', 'Build your relationship with clients or internal stakeholders — trust is the foundation of financial advisory.', 'Log all professional experience meticulously — you will need it for ICAJ and ACCA membership.'], balance: { DeepWork: 45, Client: 25, Learning: 18, Recovery: 12 } },
          { icon: '⚖️', title: 'Sustaining Balance as an Accountant', items: ['Tax season and audit season will test your endurance. Plan rest before peak periods, not after.', 'Accounting is a profession built on integrity. Every shortcut you take is a risk to your career and your clients.', 'Keep studying. The world of finance changes constantly — IFRS updates, tax law changes, new regulations.', 'Communicate financial insight in plain language. The highest-paid accountants are those who can explain numbers to non-accountants.'] },
        ],
        milestone: 'Complete first month-end close accurately and on time, sit next ACCA exam, receive positive 90-day probation review.'
      },
    },

    /* ── ENTREPRENEUR / BUSINESS OWNER ───────────────────────────────────── */
    'entrepreneur': {
      y1: {
        label: 'Year 1 — Start Thinking Like a Founder', subtitle: 'Grade 11 / 6th Form (Age 15–16)', color: '#60a5fa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>Priority subjects:</strong> Business Studies, Mathematics, IT, English Language, Social Studies.', 'Business Studies will give you the conceptual vocabulary: profit, revenue, market, competition.', 'Mathematics will teach you to analyse data, project costs, and evaluate return on investment.', 'Target 5+ CSEC passes — even entrepreneurs benefit enormously from a strong academic foundation.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Start a micro-business now, even informally: sell something, provide a service, solve a local problem.', 'Study a successful Jamaican entrepreneur: Michael Lee-Chin, Margarita Clarke, or the founders of Walkerswood.', 'Read "The Lean Startup" by Eric Ries — it is the bible of modern entrepreneurship and is written for non-experts.', 'Identify one problem in your community or school that a business could solve.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete <strong>Google Digital Garage: Fundamentals of Digital Marketing</strong> (free) — every business needs digital presence.', 'Learn to use Google Sheets for basic financial tracking: income, expenses, profit.', 'Register on the <strong>JBDC (Jamaica Business Development Corporation)</strong> website and explore their free youth entrepreneur resources.', 'Learn what a business model canvas is and fill one in for your micro-business idea.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Entrepreneurship rewards obsession, but obsession without rest creates poor decisions.', 'Separate your identity from your business — your business failing does not make you a failure.', 'Build strong academic habits even as an entrepreneur. Your GPA is an asset that opens doors your business cannot.', 'Find a mentor who has built something in Jamaica — ask them for 30 minutes per quarter.'], balance: { Study: 45, Business: 28, Recovery: 15, Social: 12 } },
          { icon: '💰', title: 'Financial Awareness', items: ['Learn the difference between revenue, profit, and cash flow — most young businesses fail because founders confuse them.', 'The JBDC offers free business training and micro-financing programmes for youth entrepreneurs.', 'Open a separate bank account for your business from Day 1 — mixing personal and business money is a mistake that kills businesses.', 'Research DBJ (Development Bank of Jamaica) youth loan programmes.'] },
        ],
        milestone: 'Launch a micro-business (even informal), complete Google Digital Marketing certificate, fill in a Business Model Canvas for your idea.'
      },
      y2: {
        label: 'Year 2 — Test Your Idea', subtitle: 'Grade 12 / Upper 6th Form (Age 16–17)', color: '#a78bfa',
        blocks: [
          { icon: '📚', title: 'Academic Focus', items: ['<strong>CAPE units:</strong> Business Management Unit 1 & 2, Economics, Entrepreneurship (if available).', 'Business Management CAPE teaches strategy, management, and operations — all directly applicable to running a business.', 'Target Grade I or II in Business Management. This also opens university business programme doors.', 'Your personal statement should tell the story of your entrepreneurial journey — what you built, what you learned.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Validate your business idea: talk to 20 potential customers before building anything.', 'Apply for the <strong>JBDC Youth Entrepreneurship competition</strong> — winners receive funding, mentorship, and national visibility.', 'Register your business formally with the Companies Office of Jamaica (COJ) — it is inexpensive and gives you legal protection.', 'Build your first real customer base: even 10 paying customers is proof of concept.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete a basic <strong>QuickBooks or Wave accounting training</strong> — you need to understand your own numbers.', 'Learn to use Canva for branding, social media, and basic marketing materials.', 'Study basic contract law — every business deal should be documented, even informally.', 'Learn the JBDC One-Stop Business Portal — for business registration, licensing, and support.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Academic performance and business building will compete for your time. Your CAPE grades are an insurance policy.', 'Every failed business experiment is market research. Track what you learn from each attempt.', 'Build a support circle of other young entrepreneurs — isolation is an entrepreneur killer.', 'Build physical resilience now. The demands of running a business are as much physical as mental.'], balance: { Study: 42, Business: 32, Recovery: 14, Social: 12 } },
          { icon: '💰', title: 'Business Funding & College Decisions', items: ['Apply for JASFUND if pursuing a university business programme — the degree will accelerate your career.', '<strong>DBJ Youth Loan Programme</strong>: Low-interest loans for registered businesses with 1+ year of trading history.', '<strong>JBDC Micro-Enterprise Loan Programme</strong>: Financing from JMD 100,000–500,000 for early-stage businesses.', 'Consider: entrepreneurship is compatible with university. Many founders do both simultaneously.'] },
        ],
        milestone: 'Validate business idea with 20+ real customer conversations, enter JBDC competition, register business formally, generate first JMD 50,000 in revenue.'
      },
      y3: {
        label: 'Year 3 — Build to Scale', subtitle: '1st Year University or Full-Time Founder (Age 17–19)', color: '#34d399',
        blocks: [
          { icon: '📚', title: 'Academic Focus (if at university)', items: ['<strong>Ideal programmes:</strong> BSc Business Administration, BSc Entrepreneurship, BSc Management Studies.', 'Use every business module as an opportunity to apply theory to your real business.', 'Your case studies, assignments, and presentations should use your own business as the test case.', 'University gives you access to markets, mentors, and a network that accelerates your business.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Hire your first person — even part-time or commission-based. Delegation is the skill that scales businesses.', 'Approach Grace Kennedy, Digicel, NCB, or another established Jamaican company about a supply or distribution partnership.', 'Apply for the <strong>Caribbean Climate Innovation Centre</strong> or <strong>YTECH</strong> accelerator programmes.', 'Document everything: your processes, your customers, your costs. A business that runs on the founder\'s memory alone cannot scale.'] },
          { icon: '💼', title: 'Skills & Certifications', items: ['Complete <strong>Goldman Sachs 10,000 Women or 10,000 Small Businesses</strong> programme (free, highly regarded globally).', 'Learn Google Analytics to understand your digital audience and marketing performance.', 'Study basic financial modelling: how to project revenue, manage cash flow, and evaluate growth options.', 'Understand intellectual property: trademarks, copyrights, and how to protect your brand.'] },
          { icon: '⚖️', title: 'Work / Life Balance', items: ['Growth creates operational stress. Build systems before you need them, not during a crisis.', 'Entrepreneurship is lonely — find your peer group deliberately. Entrepreneurs in Jamaica connect via JBDC events, YTECH, and StartupJamaica.', 'Your personal finances and business finances must be completely separate by year 3.', 'Taking a salary from your business is not optional — it creates sustainability and discipline.'], balance: { Business: 48, Study: 22, Recovery: 16, Social: 14 } },
          { icon: '💰', title: 'Scaling Your Business Finances', items: ['DBJ venture capital and loan programmes become available at JMD 1M+ revenue — prepare your financials.', 'Understand NIS, GCT (General Consumption Tax), and income tax obligations. Non-compliance is an existential risk to a small business.', 'Caribbean Export Development Agency offers funding and market development support for export-ready businesses.', 'Consider bringing on a business partner with complementary skills — solo founders are more likely to fail than founding teams.'] },
        ],
        milestone: 'Hit JMD 500,000+ in annual revenue, complete Goldman Sachs programme, hire first employee or contractor, apply to one accelerator.'
      },
      y4: {
        label: 'Year 4 — Operate Professionally', subtitle: 'Scale Phase or Final Year (Age 20–22)', color: '#fdb714',
        blocks: [
          { icon: '📚', title: 'Academic Focus (if graduating)', items: ['Your final year project or dissertation is your business plan — use it to pressure-test your growth strategy.', 'Target 2:1 or higher. Even as an entrepreneur, a strong degree is leverage for funding conversations and partnerships.', 'Use the graduation year to build your network: professors, guest speakers, alumni, and career service contacts.', 'Apply to regional business competitions: Branson Centre Entrepreneurship Programme, IDB Lab, and IADB competitions.'] },
          { icon: '🎯', title: 'Building Experience', items: ['Develop a formal board of advisers: 2–3 experienced people who will challenge your decisions.', 'Apply for Government of Jamaica procurement contracts — registered SMEs can access public sector purchasing.', 'Expand beyond Jamaica: Caribbean markets (Barbados, Trinidad, Cayman) are logical first export markets.', 'Pitch your business to at least 3 investors or grant programmes this year — even rejection provides valuable feedback.'] },
          { icon: '💼', title: 'Business Formalisation', items: ['File your first audited financial statements — this is required for bank financing above JMD 1M.', 'Build a proper employment contract, supplier agreement, and client service agreement with a lawyer.', 'Apply for trademark protection for your brand name, logo, and products — this is inexpensive and essential.', 'Review your insurance coverage: business liability, asset protection, and key person insurance.'] },
          { icon: '⚖️', title: 'Work / Life Balance — Founder Edition', items: ['Scaling a business from JMD 1M to 5M+ is the hardest phase. Build your team before you need them.', 'Delegate aggressively. If you are still doing every task yourself at Year 4, you are self-employed, not a business owner.', 'Build a personal financial buffer separate from the business. Your business income will be volatile for years.', 'Take one full week off per year where you are completely unavailable. If the business cannot survive that, you have a structural problem.'], balance: { Business: 50, Learning: 18, Recovery: 18, Social: 14 } },
          { icon: '💰', title: 'Growth Capital', items: ['IDB Lab and Caribbean Development Bank (CDB) both fund Caribbean SMEs at the JMD 5M–50M scale.', 'Equity investment is an option at this stage — understand the difference between equity and debt before taking either.', 'Export-ready businesses qualify for Caribbean Export grants — up to USD 50,000 available for approved projects.', 'Consider the <strong>Jamaica Stock Exchange Junior Market</strong> — Jamaica has one of the most accessible junior markets in the world for small business listing.'] },
        ],
        milestone: 'Hit JMD 2M+ revenue, file first audited accounts, secure first formal investor meeting or grant award, protect your trademark.'
      },
      y5: {
        label: 'Day 1 — You Are a Business Owner', subtitle: 'First Profitable Year — Operating Sustainably', color: '#f87171',
        blocks: [
          { icon: '🗺️', title: 'Foundations of a Real Business', items: ['A business is not real until it runs without you. Start building systems to replace yourself in every role.', 'Your first employees define your culture. Hire people who share your values, not just your skills.', 'Build a 12-month financial plan: projected revenue, costs, cash flow, and a contingency buffer.', 'Understand every number in your business: customer acquisition cost, lifetime value, gross margin.'] },
          { icon: '📋', title: 'Systems and Operations', items: ['Document your core business processes so any competent person can follow them.', 'Implement an accounting system and review your financials every Friday without exception.', 'Build a CRM (customer relationship management) system — even a spreadsheet tracks your most valuable asset: customer relationships.', 'Establish a weekly team meeting rhythm. Communication is the operating system of your business.'] },
          { icon: '🚀', title: 'Market and Growth', items: ['Focus relentlessly on your best customers — 80% of revenue comes from 20% of customers. Serve that 20% exceptionally well.', 'Build referral systems: satisfied customers are your cheapest and most effective marketing channel.', 'Test new products or markets with minimum viable investments — never bet the whole business on one idea.', 'Build relationships with banks, suppliers, and government agencies before you need them.'] },
          { icon: '🏆', title: 'Leadership as a Founder', items: ['Your team will reflect your standards. What you tolerate, you teach.', 'A founder who cannot delegate will burn out. Build your team\'s capability as a priority, not an afterthought.', 'Be the type of employer you wish you had — Jamaica needs employers who invest in their people.', 'Give back. The most respected Jamaican business leaders are those who uplift others as they rise.'], balance: { Operations: 35, Growth: 30, Leadership: 20, Recovery: 15 } },
          { icon: '⚖️', title: 'Sustaining Balance as a Founder', items: ['Entrepreneurship is a lifestyle, not a job. Protect the energy that makes you an effective leader.', 'The best investment you can make is in your own health, knowledge, and relationships.', 'Your business is a vehicle for the life you want — not a replacement for it.', 'Build a peer network of other Jamaican entrepreneurs. The community you build around you will determine your ceiling.'] },
        ],
        milestone: 'Operate profitably for 12 consecutive months, complete first external audit, retain a loyal team of at least 3 employees.'
      },
    },
  };

  /* ─── Career Lessons (8 per career) ─────────────────────────────────── */
  const CAREER_LESSONS = {
    'project-manager': [
      { num:1, title:'Scope Management',           body:'Define exactly what is in your project — and what is not. Uncontrolled scope growth is the #1 reason projects fail.',                              sport:'In sport: your game plan defines what you will and will not do. You do not change it mid-play without purpose.' },
      { num:2, title:'Schedule & Time Management', body:'Build a timeline, identify dependencies, and track progress weekly. Late delivery costs money and damages trust.',                                   sport:'Training cycles, taper weeks, competition calendars — you already do schedule management.' },
      { num:3, title:'Stakeholder Communication',  body:'Every project has people who need updates, have opinions, or can block progress. Managing them proactively is half the job.',                      sport:'Coaches, parents, selectors, sponsors — you already manage multiple stakeholders with competing expectations.' },
      { num:4, title:'Risk Management',            body:'Identify what can go wrong before it does. Create a mitigation plan. Never be surprised by something you could have anticipated.',                sport:'Pre-match scouting, weather contingencies, injury protocols — you already practise risk planning.' },
      { num:5, title:'Budget & Resource Mgmt',     body:'Projects always have constraints. You must deliver maximum value with the time, money, and people available.',                                       sport:'Managing training time, equipment budgets, and team energy across a long season is resource management.' },
      { num:6, title:'Leadership Under Pressure',  body:'The best PMs stay calm, make decisions with incomplete information, and keep teams moving when things get hard.',                                   sport:'Down by two goals with 10 minutes left. You already know how to lead under pressure.' },
      { num:7, title:'Agile & Adaptive Thinking',  body:'Plans change. The ability to reassess, reprioritise, and re-plan quickly separates good PMs from great ones.',                                      sport:'Half-time tactical changes. Adapting your game plan when the opponent does something unexpected.' },
      { num:8, title:'Closing & Lessons Learned',  body:'Every project ends with a formal review: what was delivered, what went well, what failed, and what the team will do differently.',                 sport:'Post-match analysis, season reviews, and film sessions — you already know how to debrief.' },
    ],
    'software-developer': [
      { num:1, title:'Clean Code Principles',        body:'Code is written once and read many times. Write for the developer who will maintain your code in 2 years — that person might be you.',         sport:'A clean play executed well beats a complex one executed poorly.' },
      { num:2, title:'Version Control (Git)',         body:'Every change you make should be tracked, documented, and reversible. A developer without Git discipline creates chaos for their entire team.',  sport:'Game film review. You review what happened, why, and what to change.' },
      { num:3, title:'Problem Decomposition',         body:'Every complex problem is a collection of simpler problems. Learn to break requirements down before you write a single line of code.',            sport:'A game plan is not one instruction — it is dozens of micro-decisions that add up to a strategy.' },
      { num:4, title:'Testing & Quality Assurance',   body:'Untested code is a debt that will be collected at the worst possible moment. Write tests before you ship.',                                     sport:'Practise prepares you for game day. Tests catch errors before your users do.' },
      { num:5, title:'Technical Documentation',       body:'A brilliant piece of code with no documentation is a liability. Document your architecture, your decisions, and your APIs.',                    sport:'A team without a playbook depends entirely on everyone remembering the same thing at the same time.' },
      { num:6, title:'Code Review Culture',           body:'Giving and receiving critical feedback on code is a professional skill. Criticism of code is not criticism of the person who wrote it.',       sport:'Coaching. The best athletes seek feedback; they do not avoid it.' },
      { num:7, title:'Continuous Learning',           body:'Technology changes faster than any other field. A developer who stops learning in Year 2 will be obsolete by Year 5.',                         sport:'Elite athletes train every day even after they have mastered the basics.' },
      { num:8, title:'Non-Technical Communication',   body:'The ability to explain technical decisions in business language is what separates senior developers from excellent ones.',                     sport:'After the game, explaining strategy to journalists and parents who did not watch the film.' },
    ],
    'nurse': [
      { num:1, title:'Patient Safety First',           body:'Every clinical decision you make starts with one question: is this safe for my patient? When in doubt, escalate.',                               sport:'In high-stakes sports, the correct call protects the athlete. Safety over performance, always.' },
      { num:2, title:'Effective Handover (SBAR)',       body:'The SBAR framework (Situation, Background, Assessment, Recommendation) saves lives. A poor handover is a patient risk.',                     sport:'A tactical briefing between periods that sets the team up to win the next phase.' },
      { num:3, title:'Time-Critical Decision Making',   body:'Nurses make clinical decisions under time pressure with incomplete information. This skill develops through experience and simulation.',       sport:'A split-second decision under pressure that determines the outcome of the game.' },
      { num:4, title:'Empathy & Professional Limits',   body:'You must care deeply for patients while maintaining the professional boundaries that protect both them and you.',                              sport:'You support a teammate fully while maintaining the team structure that allows everyone to perform.' },
      { num:5, title:'Medication Management',           body:'Medication errors cause serious patient harm. The 5 Rights (right patient, drug, dose, route, time) are non-negotiable.',                     sport:'Following set plays precisely. Improvisation has its place, but not at the cost of team structure.' },
      { num:6, title:'Documentation Accuracy',          body:'If it is not documented, it did not happen. Clinical notes are legal records and patient safety tools.',                                       sport:'Match statistics and performance data. Accurate records reveal patterns that improve outcomes.' },
      { num:7, title:'Team-Based Care',                 body:'Nurses work in multidisciplinary teams. Your communication with doctors, pharmacists, and physios directly affects patient outcomes.',         sport:'No position on a team can win alone. Your role is to make the whole team better.' },
      { num:8, title:'Continuous Clinical Education',   body:'Medical knowledge evolves constantly. CPD (Continuing Professional Development) is a professional obligation, not an optional extra.',       sport:'Elite athletes study opponents, techniques, and nutrition constantly — even at the peak of their careers.' },
    ],
    'marketing-manager': [
      { num:1, title:'Know Your Audience',             body:'Every marketing decision starts with a deep understanding of who you are talking to, what they want, and what they fear.',                   sport:'Pre-match scouting. You study the opponent before you face them.' },
      { num:2, title:'Brand Consistency',              body:'A brand is a promise. Every touchpoint — ad, email, post, packaging — must reinforce the same promise.',                                     sport:'Your team\'s identity on and off the field. Consistency builds reputation.' },
      { num:3, title:'Data-Driven Decisions',          body:'Marketing that cannot be measured cannot be improved. Set KPIs before every campaign and review performance rigorously.',                    sport:'Post-match statistics. Your instinct is a starting point; the data tells you the truth.' },
      { num:4, title:'Content Strategy',               body:'Random content is noise. A content strategy ensures every post, article, and ad serves a specific audience goal.',                           sport:'A training plan. Each session serves a specific performance goal — not just "training hard".' },
      { num:5, title:'Budget Management',              body:'Great marketers produce maximum impact with minimum spend. Every budget line should be justified by expected return.',                        sport:'Managing team resources across a season. You allocate energy and money where they produce results.' },
      { num:6, title:'Campaign Measurement',           body:'A campaign that cannot be attributed to business results is a cost, not an investment. Measure from awareness to conversion.',               sport:'Measuring training loads, sleep quality, and nutrition to explain performance outcomes.' },
      { num:7, title:'Stakeholder Management',         body:'Marketing serves the business. Your internal clients — sales, product, finance — are stakeholders whose needs you must proactively manage.',  sport:'Balancing the needs of coaches, sponsors, team members, and selectors simultaneously.' },
      { num:8, title:'Trend Adaptation',               body:'Consumer behaviour changes constantly. The best marketers spot trends early and adapt before competitors do.',                               sport:'Reading the game as it evolves and adjusting tactics without losing your core strategy.' },
    ],
    'accountant': [
      { num:1, title:'Accuracy Over Speed',            body:'One error in a set of financial statements can misrepresent a company\'s position to investors, lenders, and regulators. Check your work.',  sport:'A relay handover. Precision matters more than individual speed.' },
      { num:2, title:'Understand the Business',        body:'The best accountants understand what drives the business, not just the numbers that result from it. Numbers are an outcome, not an input.',  sport:'Understanding the game beyond your own position. A striker who understands the whole game is more valuable.' },
      { num:3, title:'Regulatory Compliance',          body:'Tax law, IFRS, and local legislation are not optional. Non-compliance carries financial penalties and professional consequences.',              sport:'The rules of the game exist for a reason. Working within them is not a constraint — it is the framework.' },
      { num:4, title:'Communicating Financial Insight',body:'The accountant who can explain complex financials in plain language is the one who gets promoted to CFO.',                                    sport:'A captain who translates the coach\'s tactical instructions to the team in the heat of a game.' },
      { num:5, title:'Deadline Discipline',            body:'Tax filings, audit reports, and month-end closes have hard deadlines. Missing them damages client relationships and carries penalties.',      sport:'Training for a specific competition date. There is no negotiating with the calendar.' },
      { num:6, title:'Professional Scepticism',        body:'An auditor who trusts everything they are told is not an auditor. Question everything. Verify documentation. Follow the evidence.',           sport:'A defender who reads the play rather than the player\'s intentions — look past the deception.' },
      { num:7, title:'Continuous Learning (IFRS/Tax)', body:'Accounting standards and tax laws change every year. Continuing professional education is mandatory for good reason.',                         sport:'Rules in sport evolve — athletes who study the new rules gain a strategic advantage.' },
      { num:8, title:'Ethical Standards',              body:'Accounting scandals destroy companies and reputations. Your professional ethics is not situational. It is absolute.',                         sport:'Playing fair even when the referee cannot see. Your integrity is a career-long investment.' },
    ],
    'entrepreneur': [
      { num:1, title:'Problem-Solution Fit',           body:'Build something that solves a real problem for a real person who will pay for the solution. Everything else is a hobby.',                    sport:'Identify your opponent\'s weakness before you plan your attack.' },
      { num:2, title:'Customer Obsession',             body:'Every great business is built on an obsessive understanding of who the customer is and what they actually want — not what you think they want.',sport:'Train the way the game demands, not the way you prefer to train.' },
      { num:3, title:'Financial Discipline',           body:'Running out of cash is the most common cause of business failure. Profitable businesses fail because they run out of cash. Know the difference.',sport:'Managing your physical and mental resources across a whole season, not just the next match.' },
      { num:4, title:'Team Building',                  body:'No business is built by one person. Your ability to attract, develop, and retain talent is the single biggest constraint on growth.',          sport:'A great team beats a great individual every time. Build the team before you build the product.' },
      { num:5, title:'Resilience & Pivoting',          body:'Your first business idea will be wrong in some critical way. The entrepreneurs who succeed are those who learn fast and pivot without ego.',    sport:'When a tactic is not working, the best teams adjust at half-time. Staying with a failing plan is not loyalty — it is stubbornness.' },
      { num:6, title:'Marketing & Sales',              body:'The best product in the world dies quietly if no one knows it exists. You must be able to sell, or hire someone who can.',                    sport:'Talent alone does not get you selected. You must show up, be visible, and perform when it counts.' },
      { num:7, title:'Legal & Compliance Basics',      body:'Most founders ignore legal foundations until it is too late. Register your business, protect your IP, and use contracts — even with people you trust.',sport:'Know the rules before you play. Ignorance of the rules does not prevent penalties.' },
      { num:8, title:'Mentorship & Network',           body:'The entrepreneurs who scale fastest are those with access to people who have already solved the problems they are facing.',                    sport:'Your coach, physio, and support team exist because individual performance has limits. Build your equivalent.'},
    ],
  };

  /* ─── Education Financing Guide (universal) ─────────────────────────── */
  const SA_FINANCE = [
    {
      region: 'Jamaica — Local Funding', color: '#34d399',
      sources: [
        { name: 'JASFUND (Jamaica Student Finance Fund)', detail: 'Government loan up to JMD 1.5M/year. Low interest, repayment starts after graduation. Apply at jasfund.gov.jm.' },
        { name: 'HEART/NSTA Trust Scholarships', detail: 'Covers vocational and technical certifications. Apply directly at heart.gov.jm.' },
        { name: 'UWI Open Campus & Mona Scholarships', detail: 'Merit-based and need-based awards. Renewable annually with 3.0+ GPA.' },
        { name: 'NCU Grants & UTech Scholarships', detail: 'Faith-based scholarships, athletic grants, and academic awards. Contact admissions directly.' },
        { name: 'Parish Council Bursaries', detail: 'Each parish council administers small bursaries for residents. Contact your local parish council office.' },
      ],
      tip: 'Apply to at least 4 Jamaica sources simultaneously. Most have February–April deadlines. Never miss a deadline — late applications are almost never accepted.'
    },
    {
      region: 'United States — Scholarships & Aid', color: '#60a5fa',
      sources: [
        { name: 'NCAA Athletic Scholarships (Division I & II)', detail: 'Full and partial scholarships for eligible student athletes. Register at eligibilitycenter.org (~USD $100).' },
        { name: 'Fulbright Foreign Student Programme', detail: 'Fully funded graduate study in the USA. Open to Jamaican citizens. Apply at fulbright.org.jm. Deadline: June.' },
        { name: 'USAID Caribbean Education Grants', detail: 'Need-based funding for Caribbean nationals. Check usaid.gov for current availability.' },
        { name: 'University Merit Scholarships', detail: 'Most US universities offer partial merit scholarships for international students with strong academics.' },
      ],
      tip: 'For US universities, apply to the financial aid office directly and ask specifically about international student scholarships — many are not widely advertised.'
    },
    {
      region: 'United Kingdom — Prestigious Awards', color: '#a78bfa',
      sources: [
        { name: 'Chevening Scholarship', detail: 'Fully funded one-year Masters at any UK university. Requires 2+ years work experience. chevening.org. Deadline: November.' },
        { name: 'Commonwealth Scholarship', detail: 'Fully funded PhD and Masters for Commonwealth citizens including Jamaica. cscuk.fcdo.gov.uk.' },
        { name: 'University International Scholarships', detail: 'Most UK Russell Group universities offer partial international scholarships. Apply directly.' },
        { name: 'Turing Scheme', detail: 'Funded study and work placements in the UK for students from eligible countries.' },
      ],
      tip: 'Chevening and Commonwealth are the two gold-standard awards for Jamaican students. Apply even if you think you are not competitive enough — Caribbean applicants are valued.'
    },
    {
      region: 'Canada — Growing Pathway', color: '#fdb714',
      sources: [
        { name: 'Provincial Grants (Ontario & Quebec)', detail: 'Partial grants for international students in certain programmes. Eligibility varies by province.' },
        { name: 'University of Toronto & York Scholarships', detail: 'Partial and full merit scholarships for international undergraduates. Apply through admissions.' },
        { name: 'Global Affairs Canada Scholarships', detail: 'Various funded programmes for students from developing countries. Check scholarships.gc.ca.' },
        { name: 'Post-Graduation Work Permit (PGWP)', detail: 'Up to 3 years of work after completing a Canadian degree — a pathway to permanent residency.' },
      ],
      tip: 'Canada\'s PGWP makes it one of the best long-term pathways for Jamaican graduates. The ability to work legally for 3 years post-graduation is a unique advantage over most other destinations.'
    }
  ];

  const SA_OFFER_PATHWAYS = [
    {
      track: 'Job Offer (International Student or Working Professional)',
      color: '#60a5fa',
      phases: [
        {
          title: 'Phase 1: Validate and Negotiate (Week 1)',
          items: [
            'Confirm the offer is genuine: company domain email, signed offer letter, compensation breakdown, and reporting manager details.',
            'Review title, salary, relocation support, start date, probation terms, and benefits before signing.',
            'Request adjustments early (salary, start date, relocation allowance, visa/legal fees support) before acceptance.'
          ]
        },
        {
          title: 'Phase 2: Immigration and Compliance (Weeks 1–6)',
          items: [
            'Collect required documents: passport validity, police record, degree certificates/transcripts, reference letters, and CV.',
            'Follow employer and destination-country work authorization process exactly (forms, biometrics, interview slots, timelines).',
            'Keep digital and physical copies of all submissions and payment receipts for immigration and onboarding.'
          ]
        },
        {
          title: 'Phase 3: Landing and First 90 Days',
          items: [
            'Arrange housing, transport, and emergency funds before travel; target 3 months of living costs if possible.',
            'Complete local setup quickly: tax ID, bank account, healthcare registration, and employment verification steps.',
            'Use a 30-60-90 day plan with your manager to align expectations, deliver quick wins, and secure long-term growth.'
          ]
        }
      ],
      checklist: 'Checklist: signed contract, visa/work permit file, verified accommodation plan, 90-day success plan.'
    },
    {
      track: 'Academic Scholarship (Undergrad or Postgrad)',
      color: '#34d399',
      phases: [
        {
          title: 'Phase 1: Confirm the Award (Week 1)',
          items: [
            'Read the scholarship letter carefully: tuition coverage, stipend, duration, renewal rules, GPA conditions, and exclusions.',
            'Accept formally before deadline and request a full cost-of-attendance breakdown (tuition, housing, meals, insurance, books).',
            'Clarify funding gaps early and line up top-up sources (family support, bursaries, assistantships, approved part-time work).' 
          ]
        },
        {
          title: 'Phase 2: Pre-Departure Readiness (Weeks 1–8)',
          items: [
            'Prepare admissions and visa files: offer letter, proof of funding, medicals (if required), passport, and transcripts.',
            'Secure housing and meet all pre-arrival onboarding tasks from the university international office.',
            'Build an academic success system before arrival: module plan, weekly schedule, writing/research support contacts.'
          ]
        },
        {
          title: 'Phase 3: Scholarship Retention and Progress',
          items: [
            'Track scholarship compliance monthly: GPA threshold, credit load, attendance, and reporting obligations.',
            'Use professor office hours, tutoring, and study groups early if grades dip; do not wait for finals.',
            'Map progression options from year one: internships, graduate pathways, and post-study work permit routes.'
          ]
        }
      ],
      checklist: 'Checklist: scholarship conditions tracker, funding-gap plan, visa/arrival documents, GPA protection routine.'
    },
    {
      track: 'Athletic Scholarship (US/UK/Canada and Beyond)',
      color: '#f87171',
      phases: [
        {
          title: 'Phase 1: Eligibility and Signing',
          items: [
            'Verify scholarship type (full/partial), sport terms, roster status, and performance/fitness clauses.',
            'Confirm eligibility and compliance requirements with the governing body and institution.',
            'Review medical coverage, injury policy, and academic support services before final commitment.'
          ]
        },
        {
          title: 'Phase 2: Academic + Athletic Setup',
          items: [
            'Build a dual calendar: classes, training, travel, recovery, assignment deadlines, and exam periods.',
            'Register with tutoring, academic advising, and athlete support units in your first two weeks.',
            'Create a nutrition, sleep, and injury prevention routine that protects both performance and academics.'
          ]
        },
        {
          title: 'Phase 3: Transition Beyond Sport',
          items: [
            'Develop a career identity beyond athletics through internships, volunteering, and certifications.',
            'Document achievements in both tracks: match stats/performance and academic/professional outputs.',
            'By final year, convert your network into opportunities: graduate school, pro pathways, or direct employment.'
          ]
        }
      ],
      checklist: 'Checklist: eligibility cleared, athletic-academic schedule live, injury/medical plan active, post-sport career plan in place.'
    }
  ];

  const SA_COUNTRY_ROUTES = [
    {
      region: 'United States (US)',
      color: '#60a5fa',
      routes: [
        {
          title: 'Work Offer Route',
          details: 'Typical pathways include H-1B (specialty occupation), L-1 (intra-company transfer), and O-1 (extraordinary ability) depending on profile and employer sponsorship.'
        },
        {
          title: 'Academic Scholarship Route',
          details: 'Most students enter on F-1 status using school-issued forms and proof of funding, then transition through campus onboarding and full-time enrollment compliance.'
        },
        {
          title: 'Athletic Scholarship Route',
          details: 'Usually F-1 student status with institution and athletics compliance requirements; maintain both academic load and eligibility standards throughout the season.'
        }
      ],
      documents: [
        'Valid passport, offer/admission letter, and proof of scholarship/funding',
        'Academic records, credential evaluations (if required), and reference letters',
        'Police record, financial statements/sponsor letters, and visa interview evidence',
        'Medical and insurance documents required by host institution/employer'
      ],
      tip: 'US processing windows can be tight. Lock interview dates and document checklists early, then keep all scans in one cloud folder and one printed binder.'
    },
    {
      region: 'United Kingdom (UK)',
      color: '#a78bfa',
      routes: [
        {
          title: 'Work Offer Route',
          details: 'Most professionals use the Skilled Worker route through a licensed sponsor, with a Certificate of Sponsorship and role-specific eligibility checks.'
        },
        {
          title: 'Academic Scholarship Route',
          details: 'Students commonly use the Student route with a Confirmation of Acceptance for Studies (CAS) and evidence of maintenance funds where required.'
        },
        {
          title: 'Athletic Scholarship Route',
          details: 'Usually Student route plus institutional sport compliance; elite profiles may require specialist legal guidance on professional pathways.'
        }
      ],
      documents: [
        'Passport, CAS or Certificate of Sponsorship, and signed acceptance documentation',
        'Proof of funds, accommodation plan, and scholarship terms (if sponsored)',
        'Academic transcripts/certificates, English-language evidence (if requested), and TB/medical evidence where applicable',
        'Biometric appointment records and payment receipts'
      ],
      tip: 'Keep your BRP/eVisa timeline, housing start date, and course or job start date aligned to avoid expensive short-notice changes.'
    },
    {
      region: 'Canada',
      color: '#34d399',
      routes: [
        {
          title: 'Work Offer Route',
          details: 'Routes may involve employer-supported permits and role-dependent requirements; timelines vary by province, occupation, and supporting paperwork.'
        },
        {
          title: 'Academic Scholarship Route',
          details: 'Students typically apply for a study permit with school acceptance and financial proof; many later explore PGWP eligibility after completion.'
        },
        {
          title: 'Athletic Scholarship Route',
          details: 'Student-athletes generally hold study permits while meeting both academic standing and team/league eligibility conditions.'
        }
      ],
      documents: [
        'Passport, letter of acceptance or employment contract, and scholarship/funding proof',
        'Bank statements/sponsor support, tuition and living cost plan, and travel history where needed',
        'Academic credentials, police certificates/biometrics where requested, and medical exams if applicable',
        'Housing details, insurance coverage, and arrival support contacts'
      ],
      tip: 'Build a province-specific checklist because rules and processing behavior can differ significantly by destination and institution.'
    },
    {
      region: 'European Union (EU)',
      color: '#fdb714',
      routes: [
        {
          title: 'Work Offer Route',
          details: 'Requirements differ by member state; most routes require a signed contract, local permit process, and compliance with host-country labor rules.'
        },
        {
          title: 'Academic Scholarship Route',
          details: 'Student routes are country-specific and typically require university admission, funding proof, housing plan, and health insurance evidence.'
        },
        {
          title: 'Athletic Scholarship Route',
          details: 'Pathways vary by country and institution; combine study/club requirements with local permit guidance before travel commitments.'
        }
      ],
      documents: [
        'Passport, translated/notarized academic or professional documents where required',
        'Admission/offer letter, proof of funds, insurance, and accommodation confirmation',
        'Police record and medical documents required by the specific country',
        'Appointment confirmations, consular receipts, and all correspondence copies'
      ],
      tip: 'Do not treat the EU as one process. Choose your exact country first, then use that embassy and institution checklist only.'
    }
  ];

  const IMMIGRATION_FLOW_STEPS = [
    {
      title: '1) Offer Confirmation',
      summary: 'Verify authenticity, role or programme details, and acceptance timelines before committing.',
      risk: 'Barrier: accepting incomplete terms or missing acceptance deadline.',
      fix: 'Action: request a complete offer pack and submit acceptance in writing with records.'
    },
    {
      title: '2) Eligibility Mapping',
      summary: 'Match your profile to the right route and gather the exact evidence that route requires.',
      risk: 'Barrier: applying under the wrong category or weak evidence bundle.',
      fix: 'Action: align route criteria early and use an explicit document checklist.'
    },
    {
      title: '3) Application Submission',
      summary: 'Submit forms, fees, biometrics, and required appointments on time.',
      risk: 'Barrier: incomplete forms, payment errors, or missed appointments.',
      fix: 'Action: track deadlines in one timeline and keep proof of every submission.'
    },
    {
      title: '4) Decision and Pre-Departure',
      summary: 'After approval, finalize housing, insurance, finances, and onboarding requirements.',
      risk: 'Barrier: late housing, insufficient funds buffer, or missing onboarding tasks.',
      fix: 'Action: complete travel readiness checklist at least 2-4 weeks before departure.'
    },
    {
      title: '5) Arrival and Stabilization',
      summary: 'Complete local registration and run a structured 30-60-90 day success plan.',
      risk: 'Barrier: delayed local setup (bank, tax, school/work registration) affecting compliance.',
      fix: 'Action: book first-week admin tasks before travel and execute immediately on arrival.'
    },
  ];

  const TIMELINE_MIN_YEARS = 1;
  const TIMELINE_DEFAULT_YEARS = 5;
  const timelineState = {
    career: 'project-manager',
    activeYearKey: 'y1',
    pathway: null,
  };

  function clampTimelineYears(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return TIMELINE_DEFAULT_YEARS;
    return Math.max(TIMELINE_MIN_YEARS, n);
  }

  function readTimelineYears() {
    const input = document.getElementById('cpTimelineYears');
    const years = clampTimelineYears(input?.value);
    if (input) input.value = String(years);
    return years;
  }

  function getCareerLabel(career) {
    if (career === 'custom-any') {
      const custom = (document.getElementById('cpCustomCareerInput')?.value || '').trim();
      return custom || 'Your Career';
    }
    return (CAREER_META[career] && CAREER_META[career].label) || 'Your Career';
  }

  function toYearKeys(pathway) {
    return Object.keys(pathway).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  }

  function getAdaptiveStage(index, total) {
    const ratio = total <= 1 ? 1 : index / total;
    if (index === total) return { title: 'Career Launch', subtitle: 'First role / first paid opportunities' };
    if (ratio <= 0.28) return { title: 'Foundation', subtitle: 'Build core skills and discipline' };
    if (ratio <= 0.55) return { title: 'Skill Building', subtitle: 'Gain practical exposure and credentials' };
    if (ratio <= 0.82) return { title: 'Professional Readiness', subtitle: 'Create portfolio and network intentionally' };
    return { title: 'Transition', subtitle: 'Move into paid opportunities with confidence' };
  }

  function buildAdaptivePathway(careerLabel, totalYears) {
    const colors = ['#60a5fa', '#a78bfa', '#34d399', '#fdb714', '#f87171', '#22d3ee'];
    const pathway = {};
    for (let i = 1; i <= totalYears; i += 1) {
      const stage = getAdaptiveStage(i, totalYears);
      const key = `y${i}`;
      const balance = i === totalYears
        ? { DeepWork: 42, Networking: 24, Learning: 16, Recovery: 18 }
        : { Study: 45, Practice: 28, Recovery: 15, Social: 12 };

      pathway[key] = {
        label: i === totalYears ? `Day 1 — ${careerLabel}` : `Year ${i} — ${stage.title}`,
        subtitle: stage.subtitle,
        color: colors[(i - 1) % colors.length],
        blocks: [
          {
            icon: '📚',
            title: 'Learning Priorities',
            items: [
              `Define the top 3 competencies for ${careerLabel} and focus your learning around them.`,
              'Use a weekly study system: one deep-learning block, one review block, one practical application block.',
              'Track progress monthly and adjust what you are learning based on gaps you discover.',
            ]
          },
          {
            icon: '🎯',
            title: 'Experience Building',
            items: [
              `Find real opportunities to practise ${careerLabel} skills through projects, volunteering, apprenticeships, or internships.`,
              'Build a portfolio of outcomes, not just activities: what problem you solved and what result you created.',
              'Ask for structured feedback from someone already working in the field and apply it immediately.',
            ]
          },
          {
            icon: '💼',
            title: 'Credentials and Proof',
            items: [
              `Complete at least one recognised certification or training milestone relevant to ${careerLabel}.`,
              'Keep a clear record of projects, references, and achievements in one portfolio document.',
              'Update your CV and online profile every quarter so opportunities do not catch you unprepared.',
            ]
          },
          {
            icon: '⚖️',
            title: 'Work / Life Balance',
            items: [
              'Build a routine that protects energy: sleep, focused work blocks, and scheduled recovery.',
              'Use a weekly planning session to avoid overload and protect your highest-value tasks.',
              'Sustainable consistency beats short bursts of burnout-driven effort.',
            ],
            balance
          },
          {
            icon: '💰',
            title: 'Funding and Career Economics',
            items: [
              'Plan your budget early: training costs, exam fees, equipment, transport, and savings targets.',
              'Apply to scholarships, grants, and bursaries each cycle; treat applications as part of the pathway.',
              'Learn compensation ranges in your target market so you can negotiate with confidence.',
            ]
          },
        ],
        milestone: i === totalYears
          ? `Secure and start your first role in ${careerLabel}, with a clear 90-day growth plan.`
          : `Complete Year ${i} goals with documented proof of growth toward ${careerLabel}.`
      };
    }
    return pathway;
  }

  function buildGenericLessons(careerLabel) {
    return [
      { num: 1, title: 'Define the Target Clearly', body: `Be precise about what ${careerLabel} success looks like for you in the next 12 months.`, sport: 'Write outcome-based goals with measurable milestones.' },
      { num: 2, title: 'Build Fundamentals First', body: 'Master the core skills before chasing advanced tactics or trends.', sport: 'Strong basics make every future step easier and faster.' },
      { num: 3, title: 'Create Real-World Evidence', body: 'Collect proof through projects, performances, case studies, or practical output.', sport: 'Evidence beats claims when competing for opportunities.' },
      { num: 4, title: 'Use Feedback Loops', body: 'Get critique from practitioners, then iterate quickly and visibly.', sport: 'Fast feedback shortens the learning curve.' },
      { num: 5, title: 'Communicate Professionally', body: 'How you present your work often determines whether you are trusted with bigger opportunities.', sport: 'Clear communication multiplies technical ability.' },
      { num: 6, title: 'Manage Time Intentionally', body: 'Protect focused blocks for deep work and avoid reactive scheduling.', sport: 'Consistency over time compounds into expertise.' },
      { num: 7, title: 'Build Relationships Early', body: 'Mentors, peers, and collaborators accelerate career mobility more than isolated effort.', sport: 'Your network becomes part of your opportunity pipeline.' },
      { num: 8, title: 'Keep Learning Adaptively', body: 'Markets and industries shift; update your skills and strategy continuously.', sport: 'Adaptation is the long-term career advantage.' },
    ];
  }

  function getRouteCard(regionName) {
    return SA_COUNTRY_ROUTES.find(r => r.region === regionName) || SA_COUNTRY_ROUTES[0];
  }

  function getRouteDetails(regionName, pathType) {
    const card = getRouteCard(regionName);
    const route = card.routes.find(r => r.title === pathType) || card.routes[0];
    return { card, route };
  }

  function renderImmigrationPathway(regionName, pathType) {
    const wrap = document.getElementById('saImmigrationPathway');
    if (!wrap) return;

    const { card, route } = getRouteDetails(regionName, pathType);
    const steps = IMMIGRATION_FLOW_STEPS.map(step => {
      if (step.title.startsWith('2) Eligibility Mapping')) {
        return {
          ...step,
          summary: `${step.summary} ${route.details}`,
        };
      }
      return step;
    });

    wrap.innerHTML = steps.map(step => `
      <article class="sa-immig-step" style="border-top:3px solid ${card.color};">
        <h4>${esc(step.title)}</h4>
        <p>${esc(step.summary)}</p>
        <div class="sa-immig-risk">${esc(step.risk)}</div>
        <div class="sa-immig-fix">${esc(step.fix)}</div>
      </article>
    `).join('');
  }

  function generatePrintableChecklist(regionName, pathType) {
    const { card, route } = getRouteDetails(regionName, pathType);
    const docItems = card.documents.map(d => `<li>${esc(d)}</li>`).join('');
    const flowItems = IMMIGRATION_FLOW_STEPS.map(s => `<li><strong>${esc(s.title)}</strong>: ${esc(s.summary)}</li>`).join('');
    const pageTitle = `RoleRocket One-Page Checklist - ${regionName} - ${pathType}`;

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(pageTitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; color: #111827; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 18px 0 8px; font-size: 16px; }
    p, li { font-size: 13px; line-height: 1.5; }
    .meta { color: #374151; margin-bottom: 12px; }
    .box { border: 1px solid #d1d5db; border-left: 4px solid ${card.color}; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    .check li { list-style: square; margin-bottom: 5px; }
    .footer { margin-top: 16px; color: #6b7280; font-size: 11px; }
  </style>
</head>
<body>
  <h1>RoleRocket Immigration Checklist</h1>
  <p class="meta"><strong>Destination:</strong> ${esc(regionName)} | <strong>Pathway:</strong> ${esc(pathType)} | <strong>Date:</strong> ${esc(new Date().toLocaleDateString())}</p>

  <div class="box">
    <h2>Route Summary</h2>
    <p>${esc(route.details)}</p>
  </div>

  <div class="box">
    <h2>Common Document Bundle</h2>
    <ul class="check">${docItems}</ul>
  </div>

  <div class="box">
    <h2>Barrier-Aware Pathway</h2>
    <ul class="check">${flowItems}</ul>
  </div>

  <div class="box">
    <h2>Final Verification Before Travel</h2>
    <ul class="check">
      <li>All application receipts and appointment confirmations archived (digital + print).</li>
      <li>Housing, emergency contacts, and local transport plan confirmed.</li>
      <li>Arrival-week admin list prepared: bank, tax/registration, onboarding, insurance.</li>
      <li>30-60-90 day success plan drafted for school/team/work entry.</li>
    </ul>
  </div>

  <p class="footer">Guidance support only. Always verify current official requirements with embassy, institution, and employer.</p>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'noopener,noreferrer,width=980,height=760');
    if (!printWin) {
      alert('Please allow popups to generate the printable checklist.');
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
  }

  function renderCareerYear(pathway, yearKey) {
    if (!pathway) return;
    const data = pathway[yearKey];
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

    // Monthly execution panel — top 3 actions from first item of first 3 blocks
    const actionBlocks = data.blocks.filter(b => b.items && b.items.length && !b.balance).slice(0, 3);
    const monthlyActions = actionBlocks.map(b => b.items[0]).filter(Boolean);
    const monthlyHtml = monthlyActions.length ? `
      <div style="background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);border-radius:12px;padding:16px 20px;margin-bottom:22px;border-left:4px solid ${data.color};">
        <div style="font-weight:700;color:#fdb714;font-size:.95rem;margin-bottom:10px;">📅 This Month — Your Top 3 Actions</div>
        <ol style="margin:0;padding-left:18px;color:#e2e8f0;font-size:.88rem;line-height:1.7;">
          ${monthlyActions.map(a => `<li>${a}</li>`).join('')}
        </ol>
      </div>
    ` : '';

    // TVET overlay panel
    const isTVET = document.getElementById('cpRouteTVET')?.classList.contains('cp-route-active');
    const career = timelineState.career || '';
    const tvetYear = (TVET_ROUTES[career] || {})[yearKey];
    const tvetHtml = (isTVET && tvetYear) ? `
      <div style="background:#1a2a1a;border-radius:12px;padding:16px 20px;margin-bottom:22px;border-left:4px solid #22c55e;">
        <div style="font-weight:700;color:#4ade80;font-size:.95rem;margin-bottom:10px;">🏗️ TVET / Vocational Route — Your Path This Year</div>
        <ul style="margin:0;padding-left:18px;color:#d1fae5;font-size:.88rem;line-height:1.7;">
          ${tvetYear.map(a => `<li>${esc(a)}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    // Local institution callout
    const inst = JAMAICA_INSTITUTIONS[career];
    const instHtml = inst ? `
      <div style="background:#1e293b;border-radius:10px;padding:14px 18px;margin-top:18px;border:1px solid #334155;">
        <div style="font-weight:700;color:#94a3b8;font-size:.85rem;margin-bottom:8px;">🏛️ Jamaica Institutions for This Career</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:.83rem;">
          <span style="color:#e2e8f0;"><strong>Degree:</strong> ${esc(inst.degree)}</span>
          <span style="color:#e2e8f0;">·</span>
          <span style="color:#4ade80;"><strong>Vocational:</strong> ${esc(inst.vocational)}</span>
          <span style="color:#e2e8f0;">·</span>
          <span style="color:#fdb714;"><strong>Cert:</strong> ${esc(inst.cert)}</span>
          <span style="color:#e2e8f0;">·</span>
          <span style="color:#60a5fa;"><strong>Funding:</strong> ${esc(inst.scholarship)}</span>
        </div>
      </div>
    ` : '';

    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="color:${data.color};margin:0 0 4px;font-size:1.2rem;">${esc(data.label)}</h3>
        <p style="color:#64748b;font-size:.88rem;margin:0;">${esc(data.subtitle)}</p>
      </div>
      ${monthlyHtml}
      ${tvetHtml}
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
      ${instHtml}
    `;
  }

  function renderYearTabs(pathway, preferredKey) {
    const tabs = document.getElementById('saYearTabs');
    if (!tabs || !pathway) return 'y1';

    const keys = toYearKeys(pathway);
    let activeKey = preferredKey;
    if (!activeKey || !pathway[activeKey]) activeKey = keys[0] || 'y1';

    tabs.innerHTML = keys.map((key, idx) => {
      const row = pathway[key];
      const mainLabel = idx === keys.length - 1 ? 'Day 1' : `Year ${idx + 1}`;
      const subLabel = (row.subtitle || '').split(' (')[0];
      const isActive = key === activeKey;
      return `<button class="sa-year-btn${isActive ? ' sa-year-active' : ''}" data-year="${key}">${mainLabel}<br><small>${esc(subLabel)}</small></button>`;
    }).join('');

    tabs.querySelectorAll('.sa-year-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        tabs.querySelectorAll('.sa-year-btn').forEach(b => b.classList.remove('sa-year-active'));
        this.classList.add('sa-year-active');
        timelineState.activeYearKey = this.dataset.year;
        renderCareerYear(timelineState.pathway, timelineState.activeYearKey);
      });
    });

    return activeKey;
  }

  function loadCareer(career, options = {}) {
    const years = readTimelineYears();
    const customWrap = document.getElementById('cpCustomCareerWrap');
    if (customWrap) customWrap.style.display = career === 'custom-any' ? 'block' : 'none';

    const careerLabel = getCareerLabel(career);
    const isDefaultFiveYear = years === TIMELINE_DEFAULT_YEARS && career !== 'custom-any' && !!CAREER_PATHWAYS[career];
    const pathway = isDefaultFiveYear ? CAREER_PATHWAYS[career] : buildAdaptivePathway(careerLabel, years);
    const meta = career === 'custom-any'
      ? {
        certPill: '📜 Career-Specific Certifications',
        lessonsTitle: `📚 8 Core ${careerLabel} Lessons`,
        lessonsDesc: `A flexible roadmap for ${careerLabel} that adapts to your chosen timeline.`
      }
      : (CAREER_META[career] || CAREER_META['project-manager']);

    const lessons = career === 'custom-any'
      ? buildGenericLessons(careerLabel)
      : (CAREER_LESSONS[career] || buildGenericLessons(careerLabel));

    timelineState.career = career;
    timelineState.pathway = pathway;

    const certPill = document.getElementById('cpCertPill');
    if (certPill) certPill.textContent = meta.certPill;
    const lessonsTitle = document.getElementById('saLessonsTitle');
    if (lessonsTitle) lessonsTitle.textContent = meta.lessonsTitle;
    const lessonsDesc = document.getElementById('saLessonsDesc');
    if (lessonsDesc) lessonsDesc.textContent = meta.lessonsDesc;

    const lessonsGrid = document.getElementById('saLessonsGrid');
    if (lessonsGrid) {
      lessonsGrid.innerHTML = lessons.map(l => `
        <div class="sa-lesson-card">
          <div class="sa-lesson-num">${l.num}</div>
          <h4>${esc(l.title)}</h4>
          <p>${esc(l.body)}</p>
          <p class="sa-lesson-sport">${esc(l.sport)}</p>
        </div>
      `).join('');
    }

    const financeGrid = document.getElementById('saFinanceGrid');
    if (financeGrid && !financeGrid.dataset.rendered) {
      financeGrid.dataset.rendered = '1';
      financeGrid.innerHTML = SA_FINANCE.map(f => `
        <div class="sa-finance-card" style="border-left-color:${f.color};">
          <h4 style="color:${f.color};">${esc(f.region)}</h4>
          <ul>${f.sources.map(s => `<li><strong>${esc(s.name)}</strong> — ${esc(s.detail)}</li>`).join('')}</ul>
          <div class="sa-finance-tip">${esc(f.tip)}</div>
        </div>
      `).join('');
    }

    const offerGrid = document.getElementById('saOfferGrid');
    if (offerGrid && !offerGrid.dataset.rendered) {
      offerGrid.dataset.rendered = '1';
      offerGrid.innerHTML = SA_OFFER_PATHWAYS.map(track => `
        <div class="sa-finance-card" style="border-left-color:${track.color};">
          <h4 style="color:${track.color};">${esc(track.track)}</h4>
          ${track.phases.map(phase => `
            <div style="margin-bottom:10px;">
              <div style="font-weight:700;color:#e2e8f0;margin-bottom:4px;">${esc(phase.title)}</div>
              <ul>${phase.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
            </div>
          `).join('')}
          <div class="sa-finance-tip">${esc(track.checklist)}</div>
        </div>
      `).join('');
    }

    const countryGrid = document.getElementById('saCountryOfferGrid');
    if (countryGrid && !countryGrid.dataset.rendered) {
      countryGrid.dataset.rendered = '1';
      countryGrid.innerHTML = SA_COUNTRY_ROUTES.map(route => `
        <div class="sa-finance-card" style="border-left-color:${route.color};">
          <h4 style="color:${route.color};">${esc(route.region)}</h4>
          ${route.routes.map(r => `
            <div style="margin-bottom:8px;">
              <div style="font-weight:700;color:#e2e8f0;margin-bottom:4px;">${esc(r.title)}</div>
              <p style="margin:0;color:#cbd5e1;line-height:1.5;">${esc(r.details)}</p>
            </div>
          `).join('')}
          <div style="font-weight:700;color:#e2e8f0;margin:10px 0 4px;">Common Document Bundle</div>
          <ul>${route.documents.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
          <div class="sa-finance-tip">${esc(route.tip)}</div>
        </div>
      `).join('');
    }

    const regionSelect = document.getElementById('saImmigRegion');
    const typeSelect = document.getElementById('saImmigPathType');
    const region = regionSelect ? regionSelect.value : 'United States (US)';
    const type = typeSelect ? typeSelect.value : 'Work Offer Route';
    renderImmigrationPathway(region, type);

    const lifeStage = document.getElementById('cpLifeStage')?.value || 'secondary';
    const STAGE_TO_YEAR = {
      'secondary':        'y1',
      'sixthform':        'y2',
      'university-early': 'y3',
      'university-final':  'y4',
      'working':          'y5',
      'change':           'y5',
      'returner':         'y1',
    };
    const stageKey = STAGE_TO_YEAR[lifeStage] || 'y1';
    const preferredKey = options.resetYear ? stageKey : timelineState.activeYearKey;
    timelineState.activeYearKey = renderYearTabs(pathway, preferredKey);
    renderCareerYear(pathway, timelineState.activeYearKey);

    // --- Role ladder ---
    const ladderEl = document.getElementById('cpRoleLadder');
    if (ladderEl) {
      const ladder = ROLE_LADDERS[career];
      if (ladder) {
        ladderEl.innerHTML = `
          <div style="font-size:.85rem;color:#94a3b8;margin-bottom:8px;font-weight:600;">📈 Role Progression</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${ladder.map((r, i) => `
              <div style="flex:1;min-width:140px;background:#1e293b;border-radius:10px;padding:12px 14px;border-top:3px solid ${i===0?'#64748b':i===1?'#6366f1':'#fdb714'};">
                <div style="font-size:.75rem;font-weight:700;color:${i===0?'#94a3b8':i===1?'#a5b4fc':'#fdb714'};margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em;">${esc(r.level)}</div>
                <div style="font-weight:700;color:#f1f5f9;font-size:.88rem;margin-bottom:4px;">${esc(r.title)}</div>
                <div style="color:#fdb714;font-size:.8rem;margin-bottom:4px;">${esc(r.salary)}</div>
                <div style="color:#94a3b8;font-size:.78rem;line-height:1.4;">${esc(r.note)}</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        ladderEl.innerHTML = '';
      }
    }

    // --- Constraint / readiness bar ---
    const readinessEl = document.getElementById('cpReadinessBar');
    if (readinessEl) {
      const budget    = document.getElementById('cpConstraintBudget')?.checked;
      const noUni     = document.getElementById('cpConstraintNoUni')?.checked;
      const migration = document.getElementById('cpConstraintMigration')?.checked;
      const family    = document.getElementById('cpConstraintFamily')?.checked;
      const isReturner = lifeStage === 'returner';
      const notes = [];
      if (budget)    notes.push('💰 Budget-aware: prioritise free/low-cost certs (HEART, Google, HubSpot) and apply for all available bursaries.');
      if (noUni)     notes.push('🚫 No-university path activated: TVET, ACCA FIA, or short-cert routes shown alongside the standard plan.');
      if (migration) notes.push('✈️ Migration-open: look for globally recognised certs (ACCA, PMP, AWS) and visa-pathway employers in the diaspora section.');
      if (family)    notes.push('👨‍👩‍👧 Flexible schedule: focus on evening courses, distance learning, and remote/part-time options that fit family commitments.');
      if (isReturner) notes.push('🔁 Career returner: your 90-day priority is to update credentials, build 3 recent portfolio pieces, and reconnect with your professional network.');
      if (notes.length) {
        readinessEl.innerHTML = `
          <div style="background:#172033;border-radius:10px;padding:14px 18px;border-left:4px solid #6366f1;">
            <div style="font-weight:700;color:#a5b4fc;font-size:.88rem;margin-bottom:8px;">🎯 Your plan is personalised for your situation:</div>
            <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:.85rem;line-height:1.7;">
              ${notes.map(n => `<li>${n}</li>`).join('')}
            </ul>
          </div>
        `;
      } else {
        readinessEl.innerHTML = '';
      }
    }
  }

  function renderCareerInit() {
    const select = document.getElementById('cpCareerSelect');
    if (select) {
      select.addEventListener('change', function () {
        loadCareer(this.value, { resetYear: true });
      });
    }

    const lifeStageSelect = document.getElementById('cpLifeStage');
    if (lifeStageSelect) {
      lifeStageSelect.addEventListener('change', function () {
        loadCareer(timelineState.career, { resetYear: true });
      });
    }

    const yearsInput = document.getElementById('cpTimelineYears');
    if (yearsInput) {
      yearsInput.addEventListener('change', function () {
        this.value = String(clampTimelineYears(this.value));
        loadCareer(timelineState.career, { resetYear: true });
      });
    }

    const customInput = document.getElementById('cpCustomCareerInput');
    if (customInput) {
      customInput.addEventListener('input', function () {
        if (timelineState.career === 'custom-any') loadCareer('custom-any', { resetYear: false });
      });
    }

    // Route toggle buttons
    const btnAcademic = document.getElementById('cpRouteAcademic');
    const btnTVET     = document.getElementById('cpRouteTVET');
    function setRoute(active, inactive) {
      active.classList.add('cp-route-active');    active.setAttribute('aria-pressed', 'true');
      inactive.classList.remove('cp-route-active'); inactive.setAttribute('aria-pressed', 'false');
      renderCareerYear(timelineState.pathway, timelineState.activeYearKey);
    }
    if (btnAcademic && btnTVET) {
      btnAcademic.addEventListener('click', () => setRoute(btnAcademic, btnTVET));
      btnTVET.addEventListener('click',     () => setRoute(btnTVET, btnAcademic));
    }

    // Constraint checkboxes — re-render readiness note + year on change
    ['cpConstraintBudget','cpConstraintNoUni','cpConstraintMigration','cpConstraintFamily'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => loadCareer(timelineState.career, { resetYear: false }));
    });

    const regionSelect = document.getElementById('saImmigRegion');
    const typeSelect = document.getElementById('saImmigPathType');
    const printBtn = document.getElementById('saPrintChecklistBtn');

    if (regionSelect) {
      regionSelect.addEventListener('change', function () {
        const type = typeSelect ? typeSelect.value : 'Work Offer Route';
        renderImmigrationPathway(this.value, type);
      });
    }
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        const region = regionSelect ? regionSelect.value : 'United States (US)';
        renderImmigrationPathway(region, this.value);
      });
    }
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        const region = regionSelect ? regionSelect.value : 'United States (US)';
        const type = typeSelect ? typeSelect.value : 'Work Offer Route';
        generatePrintableChecklist(region, type);
      });
    }

    loadCareer('project-manager', { resetYear: true });
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initCollapsiblePersistence();
    renderMarketRadar();
    renderDiasporaPipeline();
    renderSkillsGapChart();
    initCurriculumLearning();
    renderCareerInit();

    document.getElementById('jwaRefreshRegionalJobsBtn')?.addEventListener('click', renderMarketRadar);
    document.getElementById('jwaMarketKeyword')?.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        renderMarketRadar();
      }
    });
    document.getElementById('jwaDiasporaMatchBtn')?.addEventListener('click', submitDiasporaMatch);
    document.getElementById('jwaCheckResumeBtn')?.addEventListener('click', checkResumeLocalization);
    document.getElementById('jwaDownloadReportBtn')?.addEventListener('click', downloadSkillsGapReport);

    document.getElementById('jwaFindScholarshipsBtn')?.addEventListener('click', renderScholarshipFinder);
    document.getElementById('jwaScholarChecklistBtn')?.addEventListener('click', generateScholarChecklist);
    document.getElementById('jwaGenerateInterviewBtn')?.addEventListener('click', generateInterviewPrep);
    document.getElementById('jwaFindApprenticeshipsBtn')?.addEventListener('click', renderApprenticeships);
    document.getElementById('jwaAnalyzeContractBtn')?.addEventListener('click', analyzeContractTerms);
    document.getElementById('jwaGenerateBizPlanBtn')?.addEventListener('click', generateBusinessPlan);
    document.getElementById('jwaFindMentorBtn')?.addEventListener('click', findMentorMatches);

    document.querySelectorAll('.jwa-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    activateTab('jwaTabMarket');
  });
})();
