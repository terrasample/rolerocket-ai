(function initIdleTimeout(global) {
  const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  let idleTimer = null;
  let lastActivityTime = Date.now();

  function hasToken() {
    return Boolean(typeof getStoredToken === 'function' ? getStoredToken() : (global.localStorage?.getItem?.('token') || global.sessionStorage?.getItem?.('token')));
  }

  function logoutUser() {
    if (typeof clearStoredToken === 'function') {
      clearStoredToken();
    } else {
      try {
        global.localStorage?.removeItem?.('token');
        global.sessionStorage?.removeItem?.('token');
        global.localStorage?.removeItem?.('rr_user');
        global.sessionStorage?.removeItem?.('rr_user');
      } catch {
        // ignore
      }
    }
    
    // Redirect to login
    global.location.href = '/login.html?session-expired=1';
  }

  function resetIdleTimer() {
    lastActivityTime = Date.now();

    if (idleTimer) {
      clearTimeout(idleTimer);
    }

    if (hasToken()) {
      idleTimer = setTimeout(function () {
        logoutUser();
      }, IDLE_TIMEOUT_MS);
    }
  }

  function attachActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(function (event) {
      try {
        global.addEventListener(event, resetIdleTimer, true);
      } catch {
        // ignore
      }
    });
  }

  // Start monitoring on page load if user is logged in
  if (global.document?.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', function () {
      if (hasToken()) {
        attachActivityListeners();
        resetIdleTimer();
      }
    });
  } else {
    if (hasToken()) {
      attachActivityListeners();
      resetIdleTimer();
    }
  }

  global.idleTimeout = {
    reset: resetIdleTimer,
    logout: logoutUser,
    hasToken: hasToken
  };
})(window);
