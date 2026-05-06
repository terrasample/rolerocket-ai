(function (global) {
  async function sendDocumentToAccountEmail(options) {
    const payload = options || {};
    const token = typeof global.getStoredToken === 'function'
      ? global.getStoredToken()
      : (localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('authToken') || '');

    if (!token) {
      return { ok: false, error: 'Please sign in to send documents to email.' };
    }

    const body = {
      feature: String(payload.feature || 'Document').trim() || 'Document',
      filename: String(payload.filename || 'rolerocket-document').trim() || 'rolerocket-document',
      htmlContent: String(payload.htmlContent || '').trim(),
      textContent: String(payload.textContent || '').trim()
    };

    if (!body.htmlContent && !body.textContent) {
      return { ok: false, error: 'No document content available to send.' };
    }

    try {
      const res = await fetch('/api/documents/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      let data = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        data = {};
      }

      if (!res.ok) {
        return {
          ok: false,
          error: data.error || 'Failed to send document email.'
        };
      }

      return {
        ok: true,
        message: data.message || 'Document sent to your email.'
      };
    } catch (err) {
      return {
        ok: false,
        error: 'Network error while sending document email.'
      };
    }
  }

  global.sendDocumentToAccountEmail = sendDocumentToAccountEmail;
})(window);
