// Dashboard charts for personalized dashboard
// Requires Chart.js to be loaded in dashboard.html

document.addEventListener('DOMContentLoaded', function () {
  // Applications per Week (Line Chart)
  const ctxLine = document.getElementById('appsPerWeekChart');
  if (ctxLine) {
    fetch('/api/jobs/activity', { headers: { Authorization: `Bearer ${typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => {
        const chart = new Chart(ctxLine, {
          type: 'line',
          data: {
            labels: data.labels || [],
            datasets: [{
              label: 'Applications per Week',
              data: data.counts || [],
              borderColor: '#6366f1',
              backgroundColor: 'rgba(99,102,241,0.1)',
              tension: 0.3,
              fill: true
            }]
          },
          options: { responsive: true, plugins: { legend: { display: false } } }
        });
      });
  }

  // Application Status Breakdown (Pie Chart)
  const ctxPie = document.getElementById('statusBreakdownChart');
  if (ctxPie) {
    fetch('/api/jobs/status-breakdown', { headers: { Authorization: `Bearer ${typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => {
        const chart = new Chart(ctxPie, {
          type: 'pie',
          data: {
            labels: data.labels || [],
            datasets: [{
              data: data.counts || [],
              backgroundColor: ['#6366f1', '#10b981', '#f59e42', '#dc2626', '#a3a3a3'],
            }]
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
      });
  }
});
