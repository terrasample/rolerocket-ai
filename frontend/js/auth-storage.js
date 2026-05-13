(function initAuthStorage(global) {
  const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  const LAST_ACTIVITY_KEY = 'rr_last_activity_at';

  function safeGet(storage, key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(storage, key, value) {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function safeRemove(storage, key) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }

  function nowMs() {
    return Date.now();
  }

  function readLastActivity() {
    const raw = safeGet(global.localStorage, LAST_ACTIVITY_KEY) || safeGet(global.sessionStorage, LAST_ACTIVITY_KEY) || '';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function writeLastActivity(ts) {
    const value = String(ts || nowMs());
    safeSet(global.localStorage, LAST_ACTIVITY_KEY, value);
    safeSet(global.sessionStorage, LAST_ACTIVITY_KEY, value);
  }

  function hasAnyToken() {
    return Boolean(
      safeGet(global.localStorage, 'token') ||
      safeGet(global.sessionStorage, 'token') ||
      safeGet(global.localStorage, 'rr_token') ||
      safeGet(global.sessionStorage, 'rr_token')
    );
  }

  function readTokenFromStorage() {
    return (
      safeGet(global.localStorage, 'token') ||
      safeGet(global.sessionStorage, 'token') ||
      safeGet(global.localStorage, 'rr_token') ||
      safeGet(global.sessionStorage, 'rr_token') ||
      ''
    );
  }

  function isSessionExpired() {
    const last = readLastActivity();
    // If there is no stored timestamp, give the user the benefit of the doubt
    // rather than treating the absence of a timestamp as an expired session.
    if (!last) return false;
    return (nowMs() - last) > IDLE_TIMEOUT_MS;
  }

  function isLoginLikePath() {
    const path = String(global.location?.pathname || '').toLowerCase();
    return path.endsWith('/login.html') || path.endsWith('/signup.html') || path.endsWith('/forgot-password.html') || path.endsWith('/reset-password.html');
  }

  function redirectToSessionExpired() {
    if (isLoginLikePath()) return;
    try {
      global.location.href = '/login.html?session-expired=1';
    } catch {
      // ignore
    }
  }

  function getStoredToken() {
    if (hasAnyToken() && isSessionExpired()) {
      clearStoredToken();
      redirectToSessionExpired();
      return '';
    }
    const token = readTokenFromStorage();
    if (token) {
      // Keep both key names populated for backward/forward compatibility.
      safeSet(global.localStorage, 'token', token);
      safeSet(global.sessionStorage, 'token', token);
      safeSet(global.localStorage, 'rr_token', token);
      safeSet(global.sessionStorage, 'rr_token', token);
      writeLastActivity(nowMs());
    }
    return token;
  }

  function getStoredUser() {
    const raw = safeGet(global.localStorage, 'rr_user') || safeGet(global.sessionStorage, 'rr_user') || '';
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setStoredToken(token) {
    if (!token) return false;
    const writes = [
      safeSet(global.localStorage, 'token', token),
      safeSet(global.sessionStorage, 'token', token),
      safeSet(global.localStorage, 'rr_token', token),
      safeSet(global.sessionStorage, 'rr_token', token),
    ];
    const wroteAny = writes.some(Boolean);
    if (wroteAny) writeLastActivity(nowMs());
    return wroteAny;
  }

  function setStoredUser(user) {
    if (!user || typeof user !== 'object') return false;
    const serialized = JSON.stringify(user);
    const localOk = safeSet(global.localStorage, 'rr_user', serialized);
    const sessionOk = safeSet(global.sessionStorage, 'rr_user', serialized);
    if (localOk || sessionOk) writeLastActivity(nowMs());
    return localOk || sessionOk;
  }

  function clearStoredToken() {
    safeRemove(global.localStorage, 'token');
    safeRemove(global.sessionStorage, 'token');
    safeRemove(global.localStorage, 'rr_token');
    safeRemove(global.sessionStorage, 'rr_token');
    safeRemove(global.localStorage, 'rr_user');
    safeRemove(global.sessionStorage, 'rr_user');
    safeRemove(global.localStorage, LAST_ACTIVITY_KEY);
    safeRemove(global.sessionStorage, LAST_ACTIVITY_KEY);
  }

  function touchAuthActivity() {
    if (!hasAnyToken()) return;
    writeLastActivity(nowMs());
  }

  function initInactivityGuards() {
    if (hasAnyToken() && isSessionExpired()) {
      clearStoredToken();
      redirectToSessionExpired();
      return;
    }

    if (!hasAnyToken()) return;

    if (!readLastActivity()) {
      // No timestamp stored yet — write the current time rather than kicking the
      // user out. This handles cases where the token was persisted but the
      // activity timestamp was cleared (e.g. partial storage wipe).
      writeLastActivity(nowMs());
    }

    ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (eventName) {
      try {
        global.addEventListener(eventName, touchAuthActivity, true);
      } catch {
        // ignore listener errors
      }
    });
  }

  global.getStoredToken = getStoredToken;
  global.getStoredUser = getStoredUser;
  global.setStoredToken = setStoredToken;
  global.setStoredUser = setStoredUser;
  global.clearStoredToken = clearStoredToken;
  global.touchAuthActivity = touchAuthActivity;

  if (global.document?.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', initInactivityGuards);
  } else {
    initInactivityGuards();
  }
})(window);