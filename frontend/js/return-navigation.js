(function returnNavigationInit() {
  const RETURN_URL_KEY = 'rr:return:url';
  const PENDING_RESTORE_KEY = 'rr:pending:restore:url';
  const SCROLL_PREFIX = 'rr:scroll:';

  function normalizeAcceleratorLabels() {
    const nodes = document.querySelectorAll('a, button, span, div');
    nodes.forEach((node) => {
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      if (/jamaica\s+accelerator/i.test(text) && !/jamaica\s+workforce\s+accelerator/i.test(text)) {
        node.textContent = text.replace(/jamaica\s+accelerator/ig, 'Jamaica Workforce Accelerator');
      }
    });
  }

  function toSameOriginUrl(raw) {
    if (!raw) return null;
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.origin !== window.location.origin) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function getCurrentRelativeUrl() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function sanitizeRelativeUrl(raw) {
    const parsed = toSameOriginUrl(raw);
    if (!parsed) return '';
    parsed.searchParams.delete('rr_restore');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function getScrollKeyForUrl(relativeUrl) {
    return `${SCROLL_PREFIX}${relativeUrl}`;
  }

  function getPrimaryScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('main, .main, [data-scroll-container]'));
    return candidates.find((node) => node && node.scrollHeight > node.clientHeight + 4) || null;
  }

  function readScrollState() {
    const container = getPrimaryScrollContainer();
    return {
      windowY: window.scrollY || 0,
      containerY: container ? container.scrollTop || 0 : 0,
    };
  }

  function saveCurrentScrollState() {
    const relativeUrl = getCurrentRelativeUrl();
    sessionStorage.setItem(getScrollKeyForUrl(relativeUrl), JSON.stringify(readScrollState()));
  }

  function setReturnTargetToCurrentPage() {
    const relativeUrl = getCurrentRelativeUrl();
    sessionStorage.setItem(RETURN_URL_KEY, relativeUrl);
    saveCurrentScrollState();
  }

  function setPendingRestore(relativeUrl) {
    if (!relativeUrl) return;
    sessionStorage.setItem(PENDING_RESTORE_KEY, relativeUrl);
  }

  function buildRestoreUrl(relativeUrl) {
    const parsed = toSameOriginUrl(relativeUrl);
    if (!parsed) return '';
    parsed.searchParams.set('rr_restore', '1');
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function restoreScrollIfRequested() {
    const params = new URLSearchParams(window.location.search);
    const currentRelativeUrl = getCurrentRelativeUrl();
    const normalizedCurrentRelativeUrl = sanitizeRelativeUrl(currentRelativeUrl);
    const pendingRestore = sanitizeRelativeUrl(sessionStorage.getItem(PENDING_RESTORE_KEY) || '');
    const shouldRestore = params.get('rr_restore') === '1' || pendingRestore === normalizedCurrentRelativeUrl;
    if (!shouldRestore) return;

    const storedScroll = sessionStorage.getItem(getScrollKeyForUrl(normalizedCurrentRelativeUrl));
    let parsed = null;
    try {
      parsed = storedScroll ? JSON.parse(storedScroll) : null;
    } catch {
      parsed = null;
    }
    const windowY = Number.parseInt(String(parsed && parsed.windowY), 10);
    const containerY = Number.parseInt(String(parsed && parsed.containerY), 10);
    if (!Number.isNaN(windowY) || !Number.isNaN(containerY)) {
      requestAnimationFrame(() => {
        if (!Number.isNaN(windowY)) {
          window.scrollTo({ top: windowY, behavior: 'auto' });
        }
        const container = getPrimaryScrollContainer();
        if (container && !Number.isNaN(containerY)) {
          container.scrollTop = containerY;
        }
      });
    }

    sessionStorage.removeItem(PENDING_RESTORE_KEY);
    params.delete('rr_restore');
    const cleanedQuery = params.toString();
    const cleanedUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanedUrl);
  }

  function handleBackButtonClick(event) {
    const backButton = event.target.closest('.back-arrow-btn, .legal-back, [data-back-button], button[onclick*="history.back("]');
    if (!backButton) return false;

    event.preventDefault();
    event.stopPropagation();

    const currentNormalized = sanitizeRelativeUrl(getCurrentRelativeUrl());
    const referrerTarget = sanitizeRelativeUrl(document.referrer || '');
    const storedReturn = sanitizeRelativeUrl(sessionStorage.getItem(RETURN_URL_KEY) || '');
    // Prefer the browser referrer first so Back reflects the actual previous page.
    const target = referrerTarget && referrerTarget !== currentNormalized
      ? referrerTarget
      : storedReturn;

    if (!target || target === currentNormalized) {
      window.history.back();
      return true;
    }

    setPendingRestore(target);
    const restoreUrl = buildRestoreUrl(target);
    if (restoreUrl) {
      window.location.href = restoreUrl;
      return true;
    }

    window.history.back();
    return true;
  }

  function isNavigableAnchor(anchor) {
    if (!anchor) return false;
    if (anchor.target && anchor.target.toLowerCase() === '_blank') return false;
    if (anchor.hasAttribute('download')) return false;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return false;
    }
    return !!toSameOriginUrl(href);
  }

  function looksLikeNavigatingButton(button) {
    if (!button) return false;
    if (button.closest('form') && (button.type || '').toLowerCase() === 'submit') return false;
    const onclickText = button.getAttribute('onclick') || '';
    return /location\.|window\.open|history\.back\(/i.test(onclickText);
  }

  restoreScrollIfRequested();
  normalizeAcceleratorLabels();
  saveCurrentScrollState();
  window.addEventListener('scroll', saveCurrentScrollState, { passive: true });
  const primaryScrollContainer = getPrimaryScrollContainer();
  if (primaryScrollContainer) {
    primaryScrollContainer.addEventListener('scroll', saveCurrentScrollState, { passive: true });
  }
  window.addEventListener('beforeunload', saveCurrentScrollState);

  document.addEventListener('click', (event) => {
    if (handleBackButtonClick(event)) return;

    const anchor = event.target.closest('a[href]');
    if (isNavigableAnchor(anchor)) {
      setReturnTargetToCurrentPage();
      return;
    }

    const button = event.target.closest('button');
    if (looksLikeNavigatingButton(button)) {
      setReturnTargetToCurrentPage();
    }

    setTimeout(normalizeAcceleratorLabels, 0);
  }, true);
})();