/* networking-ai.js — RoleRocket AI Networking Hub */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let currentTab = 'directory';
  let dirPage = 1;
  let dirTotal = 0;
  const DIR_PAGE_SIZE = 20;
  let connFilter = 'accepted';
  let activeConnectionId = null;
  let myUserId = null;
  let myProfile = null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function token() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  async function apiFetch(path, opts = {}) {
    const url = typeof apiUrl === 'function' ? apiUrl(path) : path;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token(),
        ...(opts.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function initials(name) {
    return (name || '?')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function isJoinedNetwork() {
    return !!(myProfile && myProfile.optedIn);
  }

  function updateDirectoryAccess() {
    const joinRequired = document.getElementById('dirJoinRequired');
    const prompt = document.getElementById('dirOptInPrompt');
    const status = document.getElementById('dirStatus');
    const grid = document.getElementById('dirGrid');
    const pagination = document.getElementById('dirPagination');
    const searchIds = ['dirSearchRole', 'dirSearchIndustry', 'dirSearchLocation', 'dirSearchBtn'];

    if (!isJoinedNetwork()) {
      if (joinRequired) joinRequired.style.display = '';
      if (prompt) prompt.style.display = '';
      searchIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
      });
      if (status) status.textContent = 'Complete your networking signup in My Profile to unlock directory search.';
      if (grid) grid.innerHTML = '';
      if (pagination) pagination.innerHTML = '';
      return;
    }

    if (joinRequired) joinRequired.style.display = 'none';
    if (prompt) prompt.style.display = 'none';
    searchIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
      btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
    });
    document.querySelectorAll('.net-tab-content').forEach((el) => {
      el.style.display = 'none';
    });
    const panel = document.getElementById('tab-' + tab);
    if (panel) panel.style.display = '';

    if (tab === 'directory' && !document.querySelector('#dirGrid .pro-card')) loadDirectory();
    if (tab === 'connections') loadConnections();
    if (tab === 'my-profile') loadMyProfile();
  }

  // ── Directory ──────────────────────────────────────────────────────────────
  async function loadDirectory(page) {
    page = page || 1;
    dirPage = page;
    const role     = document.getElementById('dirSearchRole').value.trim();
    const industry = document.getElementById('dirSearchIndustry').value.trim();
    const location = document.getElementById('dirSearchLocation').value.trim();
    const status   = document.getElementById('dirStatus');
    const grid     = document.getElementById('dirGrid');

    if (!isJoinedNetwork()) {
      updateDirectoryAccess();
      return;
    }

    status.textContent = 'Loading…';
    grid.innerHTML = '';

    try {
      const params = new URLSearchParams({ page });
      if (role)     params.set('role', role);
      if (industry) params.set('industry', industry);
      if (location) params.set('location', location);

      const data = await apiFetch('/api/networking/directory?' + params.toString());
      dirTotal = data.total || 0;

      if (!data.professionals || !data.professionals.length) {
        status.textContent = 'No professionals found. Try broadening your search.';
        renderPagination();
        return;
      }

      status.textContent = dirTotal + ' professional' + (dirTotal !== 1 ? 's' : '') + ' found.';
      grid.innerHTML = data.professionals.map(renderProCard).join('');

      // Wire connect buttons
      grid.querySelectorAll('[data-connect-id]').forEach((btn) => {
        btn.addEventListener('click', () => sendConnect(btn.dataset.connectId, btn));
      });
      // Wire message buttons
      grid.querySelectorAll('[data-message-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          switchTab('connections');
        });
      });

      renderPagination();
      updateDirectoryAccess();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  }

  function renderProCard(p) {
    const statusBadge = p.connectionStatus
      ? `<span class="conn-status-badge ${esc(p.connectionStatus)}">${esc(p.connectionStatus)}</span>`
      : '';

    const connectBtn = !p.connectionStatus
      ? `<button class="btn-connect" data-connect-id="${esc(p.id)}">Connect</button>`
      : '';

    const msgBtn = p.connectionStatus === 'accepted'
      ? `<button class="btn-message" data-message-id="${esc(p.id)}">Message</button>`
      : '';

    const linkedIn = p.linkedIn
      ? `<a href="${esc(p.linkedIn)}" target="_blank" rel="noopener noreferrer" style="font-size:0.8em;color:#2563eb;text-decoration:none;">LinkedIn &#8599;</a>`
      : '';

    const skills = (p.skills || []).slice(0, 6).map((s) => `<span class="skill-chip">${esc(s)}</span>`).join('');

    return `
      <div class="pro-card">
        <div class="pro-card-header">
          <div class="pro-avatar">${esc(initials(p.name))}</div>
          <div>
            <div class="pro-name">${esc(p.name)}</div>
            <div class="pro-title">${esc(p.title)}</div>
          </div>
        </div>
        ${p.industry || p.location ? `<div class="pro-meta">${p.industry ? `<span>${esc(p.industry)}</span>` : ''}${p.location ? `<span>&#128205; ${esc(p.location)}</span>` : ''}</div>` : ''}
        ${p.bio ? `<div class="pro-bio">${esc(p.bio)}</div>` : ''}
        ${skills ? `<div class="pro-skills">${skills}</div>` : ''}
        <div class="pro-actions">
          ${connectBtn}
          ${msgBtn}
          ${statusBadge}
          ${linkedIn}
        </div>
      </div>`;
  }

  function renderPagination() {
    const el = document.getElementById('dirPagination');
    const totalPages = Math.ceil(dirTotal / DIR_PAGE_SIZE);
    if (totalPages <= 1) { el.innerHTML = ''; return; }

    let html = '';
    if (dirPage > 1) {
      html += `<button class="btn-connect" id="dirPrevBtn" style="font-size:0.88em;">&#8592; Prev</button>`;
    }
    html += `<span style="color:#94a3b8;font-size:0.88em;align-self:center;">Page ${dirPage} of ${totalPages}</span>`;
    if (dirPage < totalPages) {
      html += `<button class="btn-connect" id="dirNextBtn" style="font-size:0.88em;">Next &#8594;</button>`;
    }
    el.innerHTML = html;
    el.querySelector('#dirPrevBtn')?.addEventListener('click', () => loadDirectory(dirPage - 1));
    el.querySelector('#dirNextBtn')?.addEventListener('click', () => loadDirectory(dirPage + 1));
  }

  async function sendConnect(userId, btn) {
    if (!isJoinedNetwork()) {
      switchTab('my-profile');
      const statusEl = document.getElementById('profileStatus');
      if (statusEl) {
        statusEl.style.color = '#f59e0b';
        statusEl.textContent = 'Enable directory visibility to start connecting with professionals.';
      }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await apiFetch('/api/networking/connect', { method: 'POST', body: JSON.stringify({ toUserId: userId }) });
      btn.textContent = 'Pending';
      btn.insertAdjacentHTML('afterend', '<span class="conn-status-badge pending" style="margin-left:8px;">pending</span>');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = err.message === 'Connection already exists.' ? 'Already sent' : 'Connect';
      if (err.message !== 'Connection already exists.') alert(err.message);
    }
  }

  // ── Connections ────────────────────────────────────────────────────────────
  async function loadConnections() {
    const list = document.getElementById('connList');
    list.innerHTML = '<p style="color:#64748b;font-size:0.9em;">Loading…</p>';
    document.getElementById('msgPanel').style.display = 'none';

    try {
      const data = await apiFetch('/api/networking/connections?status=' + connFilter);
      const conns = data.connections || [];

      if (!conns.length) {
        list.innerHTML = `<p style="color:#64748b;font-size:0.9em;">${connFilter === 'pending' ? 'No pending requests.' : 'No connections yet. Browse Find Professionals to connect.'}</p>`;
        return;
      }

      list.innerHTML = conns.map((c) => {
        const isIncoming = c.direction === 'incoming' && c.status === 'pending';
        const actions = isIncoming
          ? `<div style="display:flex;gap:8px;margin-top:8px;">
               <button class="btn-connect" data-accept="${esc(c.connectionId)}" style="font-size:0.8em;padding:5px 12px;">Accept</button>
               <button class="btn-message" data-decline="${esc(c.connectionId)}" style="font-size:0.8em;padding:5px 12px;">Decline</button>
             </div>`
          : (c.status === 'accepted'
              ? `<div style="margin-top:6px;"><button class="btn-message" data-open-msg="${esc(c.connectionId)}" data-peer-name="${esc(c.peer.name)}" style="font-size:0.8em;padding:5px 12px;">Message</button></div>`
              : `<span style="font-size:0.78em;color:#64748b;">${esc(c.direction === 'outgoing' ? 'Request sent' : 'Pending')}</span>`);

        return `
          <div class="conn-thread-card" id="connCard-${esc(c.connectionId)}">
            <div style="font-weight:700;color:#e2e8f0;font-size:0.95em;">${esc(c.peer.name)}</div>
            <div style="font-size:0.82em;color:#94a3b8;">${esc(c.peer.title)}${c.peer.industry ? ' · ' + esc(c.peer.industry) : ''}</div>
            ${c.lastMessage ? `<div style="font-size:0.8em;color:#64748b;margin-top:4px;font-style:italic;">${esc(c.lastMessage)}…</div>` : ''}
            ${actions}
          </div>`;
      }).join('');

      // Wire accept/decline
      list.querySelectorAll('[data-accept]').forEach((btn) => {
        btn.addEventListener('click', () => respondConnection(btn.dataset.accept, 'accepted'));
      });
      list.querySelectorAll('[data-decline]').forEach((btn) => {
        btn.addEventListener('click', () => respondConnection(btn.dataset.decline, 'declined'));
      });
      // Wire open message
      list.querySelectorAll('[data-open-msg]').forEach((btn) => {
        btn.addEventListener('click', () => openMessagePanel(btn.dataset.openMsg, btn.dataset.peerName));
      });
    } catch (err) {
      list.innerHTML = `<p style="color:#f87171;font-size:0.9em;">${esc(err.message)}</p>`;
    }
  }

  async function respondConnection(connId, status) {
    try {
      await apiFetch('/api/networking/connect/' + connId, { method: 'PUT', body: JSON.stringify({ status }) });
      loadConnections();
    } catch (err) {
      alert(err.message);
    }
  }

  async function openMessagePanel(connId, peerName) {
    activeConnectionId = connId;
    const panel = document.getElementById('msgPanel');
    panel.style.display = '';
    document.getElementById('msgPeerName').textContent = peerName;
    document.getElementById('msgThread').innerHTML = '<p style="color:#64748b;font-size:0.88em;">Loading messages…</p>';

    // Highlight active card
    document.querySelectorAll('.conn-thread-card').forEach((c) => c.classList.remove('selected'));
    document.getElementById('connCard-' + connId)?.classList.add('selected');

    await loadMessages(connId);
  }

  async function loadMessages(connId) {
    const thread = document.getElementById('msgThread');
    try {
      const data = await apiFetch('/api/networking/messages/' + connId);
      const msgs = data.messages || [];
      if (!msgs.length) {
        thread.innerHTML = '<p style="color:#64748b;font-size:0.88em;">No messages yet. Say hello!</p>';
        return;
      }
      thread.innerHTML = msgs.map((m) => {
        const isMe = String(m.sender) === String(myUserId);
        return `<div class="msg-bubble ${isMe ? 'msg-me' : 'msg-them'}">${esc(m.text)}</div>`;
      }).join('');
      thread.scrollTop = thread.scrollHeight;
    } catch (err) {
      thread.innerHTML = `<p style="color:#f87171;font-size:0.88em;">${esc(err.message)}</p>`;
    }
  }

  async function sendMessage() {
    if (!activeConnectionId) return;
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.disabled = true;

    try {
      await apiFetch('/api/networking/messages/' + activeConnectionId, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      await loadMessages(activeConnectionId);
    } catch (err) {
      alert(err.message);
      input.value = text;
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  // ── AI Outreach ────────────────────────────────────────────────────────────
  async function generateOutreach() {
    const targetRole  = document.getElementById('aiTargetRole').value.trim();
    const goal        = document.getElementById('aiGoal').value.trim();
    const background  = document.getElementById('aiBackground').value.trim();
    const statusEl    = document.getElementById('aiStatus');
    const resultBox   = document.getElementById('aiResultBox');
    const copyRow     = document.getElementById('aiCopyRow');

    if (!targetRole || !goal) {
      statusEl.textContent = 'Please fill in who you are reaching out to and your goal.';
      return;
    }

    statusEl.textContent = 'Generating…';
    resultBox.style.display = 'none';
    copyRow.style.display = 'none';
    document.getElementById('aiGenerateBtn').disabled = true;

    try {
      const data = await apiFetch('/api/features/networking-ai', {
        method: 'POST',
        body: JSON.stringify({
          role: targetRole,
          goal,
          background,
          mode: 'outreach'
        })
      });
      const msg = data.message || data.plan || data.result || '';
      statusEl.textContent = '';
      resultBox.textContent = msg;
      resultBox.style.display = '';
      copyRow.style.display = '';
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
    } finally {
      document.getElementById('aiGenerateBtn').disabled = false;
    }
  }

  // ── My Profile ─────────────────────────────────────────────────────────────
  async function loadMyProfile() {
    try {
      const data = await apiFetch('/api/networking/profile');
      myProfile = data.profile || {};
      myUserId = data.userId || null;

      document.getElementById('profileOptIn').checked     = !!myProfile.optedIn;
      document.getElementById('profileDisplayName').value  = myProfile.displayName || data.name || '';
      document.getElementById('profileTitle').value        = myProfile.title || '';
      document.getElementById('profileIndustry').value     = myProfile.industry || '';
      document.getElementById('profileLocation').value     = myProfile.location || '';
      document.getElementById('profileBio').value          = myProfile.bio || '';
      document.getElementById('profileSkills').value       = (myProfile.skills || []).join(', ');
      document.getElementById('profileLinkedIn').value     = myProfile.linkedIn || '';
      updateDirectoryAccess();
    } catch (err) {
      document.getElementById('profileStatus').textContent = 'Error loading profile: ' + err.message;
    }
  }

  async function saveProfile() {
    const btn = document.getElementById('saveProfileBtn');
    const statusEl = document.getElementById('profileStatus');
    btn.disabled = true;
    statusEl.textContent = 'Saving…';

    try {
      await apiFetch('/api/networking/profile', {
        method: 'PUT',
        body: JSON.stringify({
          optedIn:     document.getElementById('profileOptIn').checked,
          displayName: document.getElementById('profileDisplayName').value,
          title:       document.getElementById('profileTitle').value,
          industry:    document.getElementById('profileIndustry').value,
          location:    document.getElementById('profileLocation').value,
          bio:         document.getElementById('profileBio').value,
          skills:      document.getElementById('profileSkills').value,
          linkedIn:    document.getElementById('profileLinkedIn').value
        })
      });
      statusEl.style.color = '#4ade80';
      statusEl.textContent = 'Profile saved!';
      await loadMyProfile(); // refresh
      if (isJoinedNetwork()) {
        switchTab('directory');
        loadDirectory(1);
      }
    } catch (err) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = 'Error: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ── Get own user ID from token ─────────────────────────────────────────────
  function parseUserId() {
    try {
      const tok = token();
      if (!tok) return;
      const payload = JSON.parse(atob(tok.split('.')[1]));
      myUserId = payload.id || payload.userId || payload.sub || null;
    } catch (e) { /* ignore */ }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    parseUserId();

    // Tab buttons
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Connection filter buttons
    document.querySelectorAll('[data-conn-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-conn-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        connFilter = btn.dataset.connFilter;
        loadConnections();
      });
    });

    // Directory search
    document.getElementById('dirSearchBtn').addEventListener('click', () => loadDirectory(1));
    ['dirSearchRole', 'dirSearchIndustry', 'dirSearchLocation'].forEach((id) => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadDirectory(1);
      });
    });

    // AI Outreach
    document.getElementById('aiGenerateBtn').addEventListener('click', generateOutreach);
    document.getElementById('aiCopyBtn').addEventListener('click', () => {
      const txt = document.getElementById('aiResultBox').textContent;
      navigator.clipboard.writeText(txt).then(() => {
        const btn = document.getElementById('aiCopyBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.innerHTML = '&#128203; Copy Message'; }, 2000);
      });
    });

    // Messaging
    document.getElementById('msgSendBtn').addEventListener('click', sendMessage);
    document.getElementById('msgInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Save profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

    document.getElementById('joinNetworkBtn')?.addEventListener('click', () => {
      switchTab('my-profile');
      const statusEl = document.getElementById('profileStatus');
      if (statusEl) {
        statusEl.style.color = '#60a5fa';
        statusEl.textContent = 'Turn on "Appear in the professional directory" and save your profile to join.';
      }
    });

    // Load profile first and route users through onboarding if they have not joined yet.
    loadMyProfile().then(() => {
      if (!isJoinedNetwork()) {
        switchTab('my-profile');
        const statusEl = document.getElementById('profileStatus');
        if (statusEl) {
          statusEl.style.color = '#60a5fa';
          statusEl.textContent = 'Welcome to Networking Hub. Complete your profile and enable directory visibility to start searching professionals.';
        }
      } else {
        switchTab('directory');
        loadDirectory(1);
      }
    }).catch(() => {
      switchTab('directory');
      loadDirectory(1);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
