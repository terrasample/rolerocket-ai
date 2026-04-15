(function initAuthStorage(global) {
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

  function getStoredToken() {
    return safeGet(global.localStorage, 'token') || safeGet(global.sessionStorage, 'token') || '';
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
    const localOk = safeSet(global.localStorage, 'token', token);
    const sessionOk = safeSet(global.sessionStorage, 'token', token);
    return localOk || sessionOk;
  }

  function setStoredUser(user) {
    if (!user || typeof user !== 'object') return false;
    const serialized = JSON.stringify(user);
    const localOk = safeSet(global.localStorage, 'rr_user', serialized);
    const sessionOk = safeSet(global.sessionStorage, 'rr_user', serialized);
    return localOk || sessionOk;
  }

  function clearStoredToken() {
    safeRemove(global.localStorage, 'token');
    safeRemove(global.sessionStorage, 'token');
    safeRemove(global.localStorage, 'rr_user');
    safeRemove(global.sessionStorage, 'rr_user');
  }

  global.getStoredToken = getStoredToken;
  global.getStoredUser = getStoredUser;
  global.setStoredToken = setStoredToken;
  global.setStoredUser = setStoredUser;
  global.clearStoredToken = clearStoredToken;
})(window);