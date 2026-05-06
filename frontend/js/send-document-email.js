(function (global) {
  async function blobToBase64(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
  }

  async function sendDocumentToAccountEmail(options) {
    const payload = options || {};
    const token = typeof global.getStoredToken === 'function'
      ? global.getStoredToken()
      : (localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('authToken') || '');

    if (!token) {
      return { ok: false, error: 'Please sign in to send documents to email.' };
    }

    const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const attachments = [];
    for (const attachment of rawAttachments) {
      if (!attachment?.blob || !attachment?.filename) continue;
      attachments.push({
        filename: String(attachment.filename || '').trim(),
        contentType: String(attachment.contentType || attachment.blob.type || 'application/octet-stream').trim(),
        contentBase64: await blobToBase64(attachment.blob)
      });
    }

    const body = {
      feature: String(payload.feature || 'Document').trim() || 'Document',
      filename: String(payload.filename || 'rolerocket-document').trim() || 'rolerocket-document',
      htmlContent: String(payload.htmlContent || '').trim(),
      textContent: String(payload.textContent || '').trim(),
      attachments
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
