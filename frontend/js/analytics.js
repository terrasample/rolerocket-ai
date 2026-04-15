const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
if (!token) window.location.href = 'login.html';

async function api(path) {
  const res = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function renderList(id, rows, keyLabel, valueLabel) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }

  el.innerHTML = rows
    .map((row) => `<div class="analytics-row"><strong>${escapeHtml(row[keyLabel])}</strong><span>${escapeHtml(row[valueLabel])}</span></div>`)
    .join('');
}

function renderCohorts(rows) {
  const el = document.getElementById('cohortsTable');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No cohort data</div>';
    return;
  }

  el.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>Plan</th>
          <th>Users</th>
          <th>Applied</th>
          <th>Interview</th>
          <th>Offer</th>
          <th>Interview Rate</th>
          <th>Offer Rate</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
            <tr>
              <td>${escapeHtml(r.plan)}</td>
              <td>${formatNumber(r.users)}</td>
              <td>${formatNumber(r.applied)}</td>
              <td>${formatNumber(r.interview)}</td>
              <td>${formatNumber(r.offer)}</td>
              <td>${(Number(r.interviewRate || 0) * 100).toFixed(1)}%</td>
              <td>${(Number(r.offerRate || 0) * 100).toFixed(1)}%</td>
            </tr>
          `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString();
}

function renderSignedUpUsers(rows) {
  const el = document.getElementById('signedUpUsersTable');
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No signed up users found</div>';
    return;
  }

  el.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Plan</th>
          <th>Paid</th>
          <th>Email Verified</th>
          <th>Veteran</th>
          <th>Referral Code</th>
          <th>Referrals</th>
          <th>Signed Up</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((user) => `
          <tr>
            <td>${escapeHtml(user.name || '--')}</td>
            <td>${escapeHtml(user.email || '--')}</td>
            <td>${escapeHtml(user.plan || 'free')}</td>
            <td>${user.subscribed ? 'Yes' : 'No'}</td>
            <td>${user.emailVerified ? 'Yes' : 'No'}</td>
            <td>${user.veteranVerified ? 'Yes' : 'No'}</td>
            <td>${escapeHtml(user.referralCode || '--')}</td>
            <td>${formatNumber(user.referralCount || 0)}</td>
            <td>${escapeHtml(formatDateTime(user.createdAt))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderPlanMix(usersByPlan = {}) {
  const planMixEl = document.getElementById('planMix');
  if (!planMixEl) return;

  const entries = Object.entries(usersByPlan)
    .map(([plan, users]) => ({ plan, users: Number(users || 0) }))
    .sort((a, b) => b.users - a.users);

  const totalUsers = entries.reduce((sum, entry) => sum + entry.users, 0);
  if (!entries.length || !totalUsers) {
    planMixEl.innerHTML = '<div class="empty-state">No plan mix data yet</div>';
    return;
  }

  planMixEl.innerHTML = entries
    .map(({ plan, users }) => {
      const share = ((users / totalUsers) * 100).toFixed(1);
      return `<div class="analytics-row"><strong>${escapeHtml(plan)}</strong><span>${formatNumber(users)} users · ${share}%</span></div>`;
    })
    .join('');
}

function renderPlatformLeadership(summary, publicStats) {
  const usersTotalEl = document.getElementById('analyticsUsersTotal');
  const subscribersTotalEl = document.getElementById('analyticsSubscribersTotal');
  const resumesTotalEl = document.getElementById('analyticsResumesTotal');
  const usageTotalEl = document.getElementById('analyticsUsageTotal');
  const statusEl = document.getElementById('analyticsPublicStatsStatus');
  const narrativeEl = document.getElementById('analyticsNarrative');

  const usersTotal = Number(publicStats?.usersTotal || summary?.totals?.users || 0);
  const subscribersTotal = Number(publicStats?.subscribedUsers || 0);
  const resumesTotal = Number(publicStats?.resumesTotal || 0);
  const usageTotal = Number(publicStats?.usageTotal || 0);
  const eventsTotal = Number(summary?.totals?.events || 0);
  const jobsTotal = Number(summary?.totals?.jobs || 0);
  const windowDays = Number(summary?.windowDays || 14);
  const paidShare = usersTotal ? ((subscribersTotal / usersTotal) * 100).toFixed(1) : '0.0';

  if (usersTotalEl) usersTotalEl.textContent = formatNumber(usersTotal);
  if (subscribersTotalEl) subscribersTotalEl.textContent = formatNumber(subscribersTotal);
  if (resumesTotalEl) resumesTotalEl.textContent = formatNumber(resumesTotal);
  if (usageTotalEl) usageTotalEl.textContent = formatNumber(usageTotal);

  if (statusEl) {
    const updatedAt = publicStats?.updatedAt ? new Date(publicStats.updatedAt) : null;
    statusEl.textContent = updatedAt && !Number.isNaN(updatedAt.getTime())
      ? `Live stats updated ${updatedAt.toLocaleString()}`
      : 'Live stats unavailable';
  }

  if (narrativeEl) {
    narrativeEl.innerHTML = `
      <strong>${formatNumber(usersTotal)} total signups</strong> with <strong>${formatNumber(subscribersTotal)} active paid members</strong> (${paidShare}% paid conversion) show measurable platform demand.<br>
      <strong>${formatNumber(resumesTotal)} resumes</strong> and <strong>${formatNumber(usageTotal)} tracked actions</strong> confirm that users are executing inside the product, not just registering.<br>
      Over the last <strong>${windowDays} days</strong>, telemetry captured <strong>${formatNumber(eventsTotal)} events</strong> and <strong>${formatNumber(jobsTotal)} job records</strong>, reinforcing current operating momentum.
    `;
  }
}

async function fetchPublicStats() {
  const response = await fetch(apiUrl('/api/public/stats'));
  if (!response.ok) throw new Error('Failed to load live platform stats');
  return response.json();
}

async function loadAnalytics() {
  const overview = document.getElementById('analyticsOverview');
  const narrative = document.getElementById('analyticsNarrative');
  if (overview) overview.textContent = 'Loading...';
  if (narrative) narrative.textContent = 'Loading summary...';

  try {
    const [data, publicStats, usersData] = await Promise.all([
      api('/api/admin/telemetry/summary?days=14'),
      fetchPublicStats().catch(() => null),
      api('/api/admin/users?limit=1000').catch(() => ({ users: [] }))
    ]);

    if (overview) {
      overview.innerHTML = `
        <strong>${data.windowDays}-day snapshot</strong><br>
        Events: ${formatNumber(data.totals?.events || 0)}<br>
        Users: ${formatNumber(data.totals?.users || 0)}<br>
        Jobs: ${formatNumber(data.totals?.jobs || 0)}
      `;
    }

    renderPlatformLeadership(data, publicStats);
    renderPlanMix(data.usersByPlan || {});
    renderList('topEvents', data.topEvents || [], 'event', 'count');
    renderList('funnelEvents', data.funnels || [], 'funnel', 'count');
    renderList('dailyTrend', data.trend || [], 'day', 'count');
    renderCohorts(data.cohorts || []);
    renderSignedUpUsers(usersData.users || []);
  } catch (err) {
    if (overview) overview.textContent = `Analytics unavailable: ${err.message}`;
    if (narrative) narrative.textContent = 'Platform summary unavailable right now.';
    renderSignedUpUsers([]);
  }
}

document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', loadAnalytics);
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (typeof clearStoredToken === 'function') {
    clearStoredToken();
  } else {
    localStorage.removeItem('token');
  }
  window.location.href = 'index.html';
});

loadAnalytics();
