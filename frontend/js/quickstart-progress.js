(function () {
  const STEP_ORDER = ['resume', 'tailor', 'interview', 'pipeline'];
  const STEP_META = {
    resume: { label: 'Save your resume', href: 'dashboard.html#resume' },
    tailor: { label: 'Tailor for one role', href: 'resume-generator.html' },
    interview: { label: 'Practice one hard question', href: 'ai-interview-assist.html' },
    pipeline: { label: 'Save one target job', href: 'job-tracking.html' }
  };

  const STORAGE_KEY = 'rr_quickstart_sprint_v1';
  const EVENT_KEY = 'rr_quickstart_events_v1';

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const next = {};
      STEP_ORDER.forEach((step) => {
        next[step] = parsed[step] === true;
      });
      return next;
    } catch {
      return {
        resume: false,
        tailor: false,
        interview: false,
        pipeline: false
      };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getCount(state) {
    return STEP_ORDER.filter((step) => state[step]).length;
  }

  function nextIncomplete(state) {
    const nextStep = STEP_ORDER.find((step) => !state[step]);
    if (!nextStep) return null;
    return {
      key: nextStep,
      label: STEP_META[nextStep].label,
      href: STEP_META[nextStep].href
    };
  }

  function emitUpdate(state, source) {
    const detail = {
      state,
      completed: getCount(state),
      total: STEP_ORDER.length,
      next: nextIncomplete(state),
      source: source || 'unknown'
    };

    window.dispatchEvent(new CustomEvent('rr:quickstart:updated', { detail }));
    return detail;
  }

  function pushEvent(name, payload) {
    const event = {
      name,
      payload: payload || {},
      ts: Date.now()
    };

    try {
      const list = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
      list.push(event);
      localStorage.setItem(EVENT_KEY, JSON.stringify(list.slice(-200)));
    } catch {
      // Ignore analytics queue failures.
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload || {});
    }

    if (typeof window.plausible === 'function') {
      window.plausible(name, { props: payload || {} });
    }
  }

  function setStep(step, value, source) {
    if (!STEP_META[step]) return null;

    const state = readState();
    const previous = state[step] === true;
    state[step] = !!value;
    saveState(state);

    const detail = emitUpdate(state, source || 'manual');

    if (!previous && value) {
      pushEvent('quickstart_step_completed', {
        step,
        source: source || 'manual',
        completed: detail.completed,
        total: detail.total
      });
    }

    if (previous && !value) {
      pushEvent('quickstart_step_reopened', {
        step,
        source: source || 'manual',
        completed: detail.completed,
        total: detail.total
      });
    }

    if (detail.completed === detail.total) {
      pushEvent('quickstart_completed_all', {
        source: source || 'manual'
      });
    }

    return detail;
  }

  function completeStep(step, source) {
    return setStep(step, true, source || 'auto');
  }

  function getSummary() {
    const state = readState();
    return {
      state,
      completed: getCount(state),
      total: STEP_ORDER.length,
      next: nextIncomplete(state)
    };
  }

  window.RoleRocketQuickstart = {
    steps: STEP_ORDER.slice(),
    meta: STEP_META,
    readState,
    setStep,
    completeStep,
    getSummary,
    track: pushEvent
  };
})();
