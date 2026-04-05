(function initApiBase(global) {
  const DEFAULT_LOCAL_API = 'http://localhost:5000';

  function readOverride() {
    try {
      const params = new URLSearchParams(global.location.search || '');
      const fromQuery = params.get('apiBase');
      if (fromQuery) return String(fromQuery).trim().replace(/\/$/, '');
    } catch {
      // ignore
    }

    try {
      const fromStorage = global.localStorage.getItem('rr_api_base');
      if (fromStorage) return String(fromStorage).trim().replace(/\/$/, '');
    } catch {
      // ignore
    }

    if (typeof global.__API_BASE__ === 'string' && global.__API_BASE__.trim()) {
      return global.__API_BASE__.trim().replace(/\/$/, '');
    }

    return '';
  }

  function getApiBase() {
    const override = readOverride();
    if (override) return override;

    const protocol = String(global.location.protocol || '').toLowerCase();
    const hostname = String(global.location.hostname || '').toLowerCase();
    const port = String(global.location.port || '');
    const isHttp = protocol === 'http:' || protocol === 'https:';

    if (!isHttp || protocol === 'file:') {
      return DEFAULT_LOCAL_API;
    }

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    ) {
      if (!port || port === '5000') return `${global.location.protocol}//${hostname}${port ? `:${port}` : ''}`;
      return `${global.location.protocol}//${hostname}:5000`;
    }

    return global.location.origin;
  }

  function apiUrl(path) {
    const value = String(path || '');
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return `${getApiBase()}${value}`;
    return `${getApiBase()}/${value}`;
  }

  global.getApiBase = getApiBase;
  global.apiUrl = apiUrl;

  // Utility to show/hide the no resume message
  global.showNoResumeMsg = function(show) {
    const msg = document.getElementById('noResumeMsg');
    if (msg) msg.style.display = show ? 'block' : 'none';
  };
})(window);