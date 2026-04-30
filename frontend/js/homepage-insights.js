document.addEventListener('DOMContentLoaded', function () {
  const insightsWrap = document.getElementById('jobSeekerInsights');
  const meta = document.getElementById('jobSeekerInsightsMeta');
  if (!insightsWrap || !meta) {
    return;
  }

  function summarizeTopRoles(industries) {
    const entries = Object.entries(industries || {})
      .map(([industry, roles]) => ({
        industry,
        roles: Array.isArray(roles) ? roles.filter(Boolean) : []
      }))
      .filter((entry) => entry.roles.length)
      .sort((a, b) => b.roles.length - a.roles.length)
      .slice(0, 3);

    return entries;
  }

  function formatUpdatedAt(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return 'Updated recently';
    }

    return `Last refresh: ${date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`;
  }

  function formatSources(sources) {
    if (!Array.isArray(sources) || !sources.length) {
      return 'Sources: Configured live job feeds';
    }

    return `Sources: ${sources.join(', ')}`;
  }

  function renderInsights(entries) {
    if (!entries.length) {
      insightsWrap.innerHTML = `
        <article class="marketing-card tier-feature premium">
          <h3>Live market data is loading</h3>
          <p>We could not read enough live role data right now. Please refresh in a moment.</p>
        </article>
      `;
      return;
    }

    const tierOrder = ['pro', 'premium', 'elite'];
    insightsWrap.innerHTML = entries.map((entry, index) => {
      const tier = tierOrder[index] || 'premium';
      const topRoles = entry.roles.slice(0, 3).join(', ');
      return `
        <article class="marketing-card tier-feature ${tier}">
          <h3>${entry.industry} is actively hiring</h3>
          <p>Trending roles: ${topRoles}</p>
        </article>
      `;
    }).join('');
  }

  (async function loadLivePulse() {
    try {
      const response = await fetch(apiUrl('/api/in-demand-jobs'), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }

      const data = await response.json();
      const topEntries = summarizeTopRoles(data.industries);
      renderInsights(topEntries);
      meta.textContent = `${formatUpdatedAt(data.updatedAt)} | ${formatSources(data.sources)}`;
    } catch (_) {
      insightsWrap.innerHTML = `
        <article class="marketing-card tier-feature premium">
          <h3>Live market pulse unavailable</h3>
          <p>We could not reach the live market feed right now. Please try again shortly.</p>
        </article>
      `;
      meta.textContent = 'Live source feed temporarily unavailable';
    }
  })();
});