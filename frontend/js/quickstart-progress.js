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
  const EVENT_ID_KEY = 'rr_quickstart_event_id_v1';
  const SESSION_KEY = 'rr_quickstart_session_v1';
  let syncInFlight = false;

  function getToken() {
    return localStorage.getItem('token')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken')
      || sessionStorage.getItem('authToken')
      || '';
  }

  function getSessionId() {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `qs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, created);
    return created;
  }

  function nextEventId() {
    const value = Number(localStorage.getItem(EVENT_ID_KEY) || '0') + 1;
    localStorage.setItem(EVENT_ID_KEY, String(value));
    return value;
  }

  function readEvents() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVENT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEvents(events) {
    localStorage.setItem(EVENT_KEY, JSON.stringify(events.slice(-200)));
  }

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
      id: nextEventId(),
      name,
      payload: payload || {},
      ts: Date.now(),
      synced: false
    };

    try {
      const list = readEvents();
      list.push(event);
      saveEvents(list);
    } catch {
      // Ignore analytics queue failures.
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', name, payload || {});
    }

    if (typeof window.plausible === 'function') {
      window.plausible(name, { props: payload || {} });
    }

    syncEventsToBackend();
  }

  async function syncEventsToBackend() {
    if (syncInFlight || !navigator.onLine) return;

    const token = getToken();
    if (!token) return;

    const events = readEvents();
    const unsynced = events.filter((evt) => evt && evt.synced !== true).slice(0, 40);
    if (!unsynced.length) return;

    const payload = unsynced.map((evt) => ({
      event: String(evt.name || '').slice(0, 80),
      funnel: 'quickstart',
      sessionId: getSessionId(),
      page: 'quickstart',
      variant: '',
      ts: new Date(Number(evt.ts || Date.now())).toISOString(),
      meta: {
        ...(evt.payload || {}),
        clientEventId: evt.id || null
      }
    }));

    syncInFlight = true;
    try {
      const res = await fetch('/api/telemetry/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ events: payload })
      });

      if (!res.ok) return;

      const sentIds = new Set(unsynced.map((evt) => evt.id));
      const remaining = readEvents().filter((evt) => !sentIds.has(evt.id));
      saveEvents(remaining);
    } catch {
      // Keep events queued for later retries.
    } finally {
      syncInFlight = false;
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
    track: pushEvent,
    sync: syncEventsToBackend
  };

  window.addEventListener('online', () => {
    syncEventsToBackend();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncEventsToBackend();
    }
  });

  setInterval(() => {
    syncEventsToBackend();
  }, 15000);

  syncEventsToBackend();
})();
