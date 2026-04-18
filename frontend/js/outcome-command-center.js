document.addEventListener('DOMContentLoaded', async function () {
  const statusEl = document.getElementById('occStatus');
  const pipelineHealthEl = document.getElementById('occPipelineHealth');
  const interviewOddsEl = document.getElementById('occInterviewOdds');
  const offerOddsEl = document.getElementById('occOfferOdds');
  const coreActionsEl = document.getElementById('occCoreActions');
  const bottlenecksEl = document.getElementById('occBottlenecks');
  const nextActionEl = document.getElementById('occNextAction');

  function getToken() {
    if (typeof getStoredToken === 'function') return getStoredToken() || '';
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  function pickNextAction(recommendations, mine) {
    if (Array.isArray(recommendations) && recommendations.length) {
      return String(recommendations[0]);
    }

    const interview = Number(mine?.interview || 0);
    const applied = Number(mine?.applied || 0);

    if (applied >= 8 && interview === 0) {
      return 'Run ATS Optimizer on your next 3 roles and submit those applications within 48 hours.';
    }

    if (applied < 5) {
      return 'Queue 5 high-match roles today and move them to ready status for one-click execution.';
    }

    return 'Follow up on the top 3 oldest active applications and schedule one interview practice block today.';
  }

  function renderList(items) {
    if (!Array.isArray(items) || !items.length) {
      bottlenecksEl.innerHTML = '<li>None detected right now. Keep your current rhythm and track new outcomes daily.</li>';
      return;
    }

    bottlenecksEl.innerHTML = items
      .slice(0, 4)
      .map((item) => `<li>${String(item)}</li>`)
      .join('');
  }

  function healthLabel(mine) {
    const applied = Number(mine?.applied || 0);
    const interview = Number(mine?.interview || 0);
    const offer = Number(mine?.offer || 0);

    if (offer >= 1) return 'High Momentum';
    if (applied >= 8 && interview >= 2) return 'Strong';
    if (applied >= 5) return 'Building';
    return 'Early Stage';
  }

  const token = getToken();
  if (!token) {
    statusEl.textContent = 'Please log in to view your command center.';
    return;
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [proofRes, recRes, modeRes] = await Promise.all([
      fetch('/api/outcomes/proof', { headers }),
      fetch('/api/recommendations/adaptive', { headers }),
      fetch('/api/dashboard/mode-kpis?days=7', { headers })
    ]);

    const proof = await proofRes.json();
    const rec = await recRes.json();
    const mode = await modeRes.json();

    if (!proofRes.ok) {
      throw new Error(proof.error || 'Could not load outcome proof.');
    }

    const mine = proof.mine || {};
    const interviewRate = Number(mine.interviewRate || 0) * 100;
    const offerRate = Number(mine.offerRate || 0) * 100;

    pipelineHealthEl.textContent = healthLabel(mine);
    interviewOddsEl.textContent = `${interviewRate.toFixed(1)}%`;
    offerOddsEl.textContent = `${offerRate.toFixed(1)}%`;

    const weeklyCoreActions = Number(mode?.byMode?.starter?.oneClickRuns || 0) + Number(mode?.byMode?.power?.oneClickRuns || 0);
    coreActionsEl.textContent = String(weeklyCoreActions);

    const recommendations = Array.isArray(rec?.recommendations) ? rec.recommendations : [];
    renderList(recommendations.slice(0, 3));

    nextActionEl.textContent = pickNextAction(recommendations, mine);
    statusEl.textContent = 'Command center ready.';
  } catch (error) {
    statusEl.textContent = error.message || 'Could not load command center right now.';
    pipelineHealthEl.textContent = '--';
    interviewOddsEl.textContent = '--';
    offerOddsEl.textContent = '--';
    coreActionsEl.textContent = '--';
    bottlenecksEl.innerHTML = '<li>Could not load bottlenecks right now.</li>';
    nextActionEl.textContent = '--';
  }
});
