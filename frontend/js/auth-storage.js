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

  function setStoredToken(token) {
    if (!token) return false;
    const localOk = safeSet(global.localStorage, 'token', token);
    const sessionOk = safeSet(global.sessionStorage, 'token', token);
    return localOk || sessionOk;
  }

  function clearStoredToken() {
    safeRemove(global.localStorage, 'token');
    safeRemove(global.sessionStorage, 'token');
  }

  global.getStoredToken = getStoredToken;
  global.setStoredToken = setStoredToken;
  global.clearStoredToken = clearStoredToken;
})(window);