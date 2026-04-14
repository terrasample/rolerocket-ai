document.addEventListener('DOMContentLoaded', function () {
  const storageKey = 'rolerocket-gamification-state';
  const pointsEl = document.getElementById('gamePoints');
  const streakEl = document.getElementById('gameStreak');
  const levelEl = document.getElementById('gameLevel');
  const badgesEl = document.getElementById('gameBadges');
  const historyEl = document.getElementById('gameHistory');
  const outputEl = document.getElementById('gamificationOutput');
  const resetBtn = document.getElementById('resetGamificationBtn');
  const actionButtons = Array.from(document.querySelectorAll('.game-action-btn'));

  const actionConfig = {
    application: { label: 'Job Application', points: 20 },
    interview: { label: 'Interview Prep Session', points: 15 },
    networking: { label: 'Networking Outreach', points: 10 },
    skill: { label: 'Skill Sprint', points: 12 }
  };

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {
        points: 0,
        streak: 0,
        lastActionDate: '',
        counts: {},
        history: []
      };
    } catch {
      return {
        points: 0,
        streak: 0,
        lastActionDate: '',
        counts: {},
        history: []
      };
    }
  }

  function saveState(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function getLevel(points) {
    if (points >= 250) return 'Closer';
    if (points >= 150) return 'Momentum Builder';
    if (points >= 75) return 'Consistent Candidate';
    return 'Rookie';
  }

  function getBadges(state) {
    const badges = [];
    if ((state.counts.application || 0) >= 5) badges.push('Application Sprint');
    if ((state.counts.interview || 0) >= 3) badges.push('Interview Ready');
    if ((state.counts.networking || 0) >= 5) badges.push('Network Builder');
    if ((state.counts.skill || 0) >= 5) badges.push('Skill Sharpener');
    if (state.streak >= 5) badges.push('5-Day Streak');
    if (state.points >= 150) badges.push('Momentum Milestone');
    return badges.length ? badges : ['No badges yet. Log activity to start earning them.'];
  }

  function render(state) {
    pointsEl.textContent = String(state.points);
    streakEl.textContent = `${state.streak} day${state.streak === 1 ? '' : 's'}`;
    levelEl.textContent = getLevel(state.points);
    badgesEl.innerHTML = getBadges(state).map((badge) => `<li>${badge}</li>`).join('');
    historyEl.innerHTML = (state.history.length ? state.history : ['No activity logged yet.'])
      .slice(0, 6)
      .map((item) => `<li>${item}</li>`)
      .join('');
  }

  function updateStreak(state) {
    const today = new Date().toISOString().slice(0, 10);
    if (!state.lastActionDate) {
      state.streak = 1;
      state.lastActionDate = today;
      return;
    }

    const last = new Date(state.lastActionDate);
    const now = new Date(today);
    const diffDays = Math.round((now - last) / 86400000);
    if (diffDays === 0) {
      return;
    }
    if (diffDays === 1) {
      state.streak += 1;
    } else {
      state.streak = 1;
    }
    state.lastActionDate = today;
  }

  const state = loadState();
  render(state);

  actionButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const action = actionConfig[button.dataset.action];
      if (!action) {
        return;
      }
      updateStreak(state);
      state.points += action.points;
      state.counts[button.dataset.action] = (state.counts[button.dataset.action] || 0) + 1;
      state.history.unshift(`${action.label} logged on ${new Date().toLocaleDateString()}`);
      state.history = state.history.slice(0, 10);
      saveState(state);
      render(state);
      outputEl.innerHTML = `<div style="color:#16a34a;">${action.label} logged. +${action.points} points.</div>`;
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      localStorage.removeItem(storageKey);
      const freshState = loadState();
      render(freshState);
      outputEl.innerHTML = '<div style="color:#2563eb;">Gamification progress reset.</div>';
    });
  }
});