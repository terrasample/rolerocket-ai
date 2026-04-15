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

function renderList(id, rows, keyLabel, valueLabel) {
  const el = document.getElementById(id);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }

  el.innerHTML = rows
    .map((row) => `<div class="analytics-row"><strong>${row[keyLabel]}</strong><span>${row[valueLabel]}</span></div>`)
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
              <td>${r.plan}</td>
              <td>${r.users}</td>
              <td>${r.applied}</td>
              <td>${r.interview}</td>
              <td>${r.offer}</td>
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

async function loadAnalytics() {
  const overview = document.getElementById('analyticsOverview');
  if (overview) overview.textContent = 'Loading...';

  try {
    const data = await api('/api/admin/telemetry/summary?days=14');

    if (overview) {
      overview.innerHTML = `
        <strong>${data.windowDays}-day snapshot</strong><br>
        Events: ${Number(data.totals?.events || 0).toLocaleString()}<br>
        Users: ${Number(data.totals?.users || 0).toLocaleString()}<br>
        Jobs: ${Number(data.totals?.jobs || 0).toLocaleString()}
      `;
    }

    renderList('topEvents', data.topEvents || [], 'event', 'count');
    renderList('funnelEvents', data.funnels || [], 'funnel', 'count');
    renderList('dailyTrend', data.trend || [], 'day', 'count');
    renderCohorts(data.cohorts || []);
  } catch (err) {
    if (overview) overview.textContent = `Analytics unavailable: ${err.message}`;
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
