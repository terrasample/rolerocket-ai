function formatHomepageStat(value) {
  return Number(value || 0).toLocaleString();
}

function renderUsagePie(pieEl, resumesTotal, jobsTrackedTotal, applicationsTotal) {
  if (!pieEl) return;

  const resumes = Number(resumesTotal || 0);
  const jobs = Number(jobsTrackedTotal || 0);
  const applications = Number(applicationsTotal || 0);
  const total = resumes + jobs + applications;

  if (!total) {
    pieEl.style.background = 'linear-gradient(135deg, #e2e8f0, #cbd5e1)';
    return;
  }

  const resumesPct = (resumes / total) * 100;
  const jobsPct = (jobs / total) * 100;
  const applicationsPct = Math.max(0, 100 - resumesPct - jobsPct);

  pieEl.style.background = `conic-gradient(#1d4ed8 0 ${resumesPct}%, #0f766e ${resumesPct}% ${resumesPct + jobsPct}%, #f59e0b ${resumesPct + jobsPct}% ${resumesPct + jobsPct + applicationsPct}%)`;
}

function getStatsElements(prefix) {
  return {
    pieEl: document.getElementById(`${prefix}StatsPie`),
    usersEl: document.getElementById(`${prefix}UsersTotal`),
    subscribersEl: document.getElementById(`${prefix}SubscribersTotal`),
    resumesEl: document.getElementById(`${prefix}ResumesTotal`),
    jobsEl: document.getElementById(`${prefix}JobsTotal`),
    applicationsEl: document.getElementById(`${prefix}ApplicationsTotal`),
    usageEl: document.getElementById(`${prefix}UsageTotal`),
    narrativeEl: document.getElementById(`${prefix}StatsNarrative`),
    paidShareEl: document.getElementById(`${prefix}PaidShare`),
    statusEl: document.getElementById(`${prefix}StatsStatus`),
    detailTitleEl: document.getElementById(`${prefix}StatsDetailTitle`),
    detailBodyEl: document.getElementById(`${prefix}StatsDetailBody`)
  };
}

function setActivePublicStatCard(prefix, statKey) {
  document.querySelectorAll(`[data-stat-prefix="${prefix}"][data-stat-detail]`).forEach((card) => {
    const isActive = card.dataset.statDetail === statKey;
    card.classList.toggle('stat-kpi-active', isActive);
    card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function renderPublicStatsDetail(prefix, stats, statKey) {
  const { detailTitleEl, detailBodyEl } = getStatsElements(prefix);
  if (!detailTitleEl || !detailBodyEl) return;

  const usersTotal = Number(stats.usersTotal || 0);
  const subscribersTotal = Number(stats.subscribedUsers || 0);
  const resumesTotal = Number(stats.resumesTotal || 0);
  const jobsTrackedTotal = Number(stats.jobsTrackedTotal || 0);
  const applicationsTotal = Number(stats.applicationsTotal || 0);
  const usageTotal = Number(stats.usageTotal || (resumesTotal + jobsTrackedTotal + applicationsTotal));
  const paidShare = usersTotal ? ((subscribersTotal / usersTotal) * 100).toFixed(1) : '0.0';

  if (statKey === 'users') {
    detailTitleEl.textContent = 'Total signups';
    detailBodyEl.innerHTML = `
      <p><strong>${formatHomepageStat(usersTotal)}</strong> total accounts have signed up for RoleRocket AI.</p>
      <p>This is the broadest demand signal for the platform.</p>
    `;
  } else if (statKey === 'subscribers') {
    detailTitleEl.textContent = 'Active paid members';
    detailBodyEl.innerHTML = `
      <p><strong>${formatHomepageStat(subscribersTotal)}</strong> users are currently paying members.</p>
      <p>That represents <strong>${paidShare}%</strong> of all current signups.</p>
    `;
  } else {
    detailTitleEl.textContent = 'Total recorded activity';
    detailBodyEl.innerHTML = `
      <p><strong>${formatHomepageStat(usageTotal)}</strong> tracked actions have been recorded across the platform.</p>
      <p>Breakdown: <strong>${formatHomepageStat(resumesTotal)}</strong> resumes built, <strong>${formatHomepageStat(jobsTrackedTotal)}</strong> jobs tracked, and <strong>${formatHomepageStat(applicationsTotal)}</strong> applications logged.</p>
    `;
  }

  setActivePublicStatCard(prefix, statKey);
}

function initPublicStatsInteractions(prefix) {
  document.querySelectorAll(`[data-stat-prefix="${prefix}"][data-stat-detail]`).forEach((card) => {
    card.addEventListener('click', () => {
      if (!window.roleRocketPublicStats) return;
      renderPublicStatsDetail(prefix, window.roleRocketPublicStats, card.dataset.statDetail || 'activity');
    });
  });
}

function renderStatsSummary(prefix, stats) {
  const {
    pieEl,
    usersEl,
    subscribersEl,
    resumesEl,
    jobsEl,
    applicationsEl,
    usageEl,
    narrativeEl,
    paidShareEl,
    statusEl
  } = getStatsElements(prefix);

  if (!usersEl || !subscribersEl || !resumesEl || !jobsEl || !applicationsEl || !usageEl) {
    return;
  }

  const usersTotal = Number(stats.usersTotal || 0);
  const subscribersTotal = Number(stats.subscribedUsers || 0);
  const resumesTotal = Number(stats.resumesTotal || 0);
  const jobsTrackedTotal = Number(stats.jobsTrackedTotal || 0);
  const applicationsTotal = Number(stats.applicationsTotal || 0);
  const usageTotal = Number(stats.usageTotal || (resumesTotal + jobsTrackedTotal + applicationsTotal));
  const paidShare = usersTotal ? ((subscribersTotal / usersTotal) * 100).toFixed(1) : '0.0';

  usersEl.textContent = formatHomepageStat(usersTotal);
  subscribersEl.textContent = formatHomepageStat(subscribersTotal);
  resumesEl.textContent = formatHomepageStat(resumesTotal);
  jobsEl.textContent = formatHomepageStat(jobsTrackedTotal);
  applicationsEl.textContent = formatHomepageStat(applicationsTotal);
  usageEl.textContent = formatHomepageStat(usageTotal);
  renderUsagePie(pieEl, resumesTotal, jobsTrackedTotal, applicationsTotal);

  if (narrativeEl) {
    narrativeEl.innerHTML = `
      <strong>${formatHomepageStat(usersTotal)} signups</strong> and <strong>${formatHomepageStat(subscribersTotal)} paid members</strong> show real market pull, not placeholder traction.<br>
      Users have already generated <strong>${formatHomepageStat(resumesTotal)} resumes</strong>, tracked <strong>${formatHomepageStat(jobsTrackedTotal)} jobs</strong>, and logged <strong>${formatHomepageStat(applicationsTotal)} applications</strong> inside one platform.<br>
      That means <strong>${formatHomepageStat(usageTotal)} tracked actions</strong> have already moved through the RoleRocket AI workflow.
    `;
  }

  if (paidShareEl) {
    paidShareEl.textContent = `${paidShare}% of signed-up users are active paid members right now, proving upgrade intent.`;
  }

  if (statusEl) {
    const updatedAt = stats.updatedAt ? new Date(stats.updatedAt) : null;
    statusEl.textContent = updatedAt && !Number.isNaN(updatedAt.getTime())
      ? `Live stats updated ${updatedAt.toLocaleString()}`
      : 'Live stats updated just now';
  }

  renderPublicStatsDetail(prefix, stats, 'activity');
}

function renderStatsError(prefix) {
  const { narrativeEl, paidShareEl, statusEl } = getStatsElements(prefix);
  if (narrativeEl) narrativeEl.textContent = 'Live platform stats are temporarily unavailable.';
  if (paidShareEl) paidShareEl.textContent = 'Paid-member share is temporarily unavailable.';
  if (statusEl) statusEl.textContent = 'Live platform stats are temporarily unavailable.';
}

async function loadHomepagePlatformStats() {
  // Only load platform stats for admin users
  const token = localStorage.getItem('token');
  if (!token) {
    return; // Not logged in, don't load stats
  }

  try {
    const response = await fetch((typeof getApiBase === 'function' ? getApiBase() : '') + '/api/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!data.user?.isAdmin) {
      return; // Not an admin, don't load stats
    }
  } catch (_err) {
    return; // Error checking user, don't load stats
  }

  const homepageElements = getStatsElements('homepage');
  const pricingElements = getStatsElements('pricing');
  if (!homepageElements.usersEl && !pricingElements.usersEl) {
    return;
  }

  try {
    const statsResponse = await fetch(apiUrl('/api/public/stats'));
    if (!statsResponse.ok) throw new Error('Failed to load platform stats');

    const stats = await statsResponse.json();
    window.roleRocketPublicStats = stats;
    renderStatsSummary('homepage', stats);
    renderStatsSummary('pricing', stats);
  } catch (err) {
    renderStatsError('homepage');
    renderStatsError('pricing');
  }
}

initPublicStatsInteractions('homepage');
initPublicStatsInteractions('pricing');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHomepagePlatformStats);
} else {
  loadHomepagePlatformStats();
}