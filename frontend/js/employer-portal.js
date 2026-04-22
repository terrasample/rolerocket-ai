/* employer-portal.js — Client-side logic for the Employer Portal page */
(function () {
  'use strict';

  const STORAGE_KEY = 'ep_token';
  const COMPANY_KEY = 'ep_company';

  function apiBase() {
    return (typeof getApiBase === 'function' ? getApiBase() : '') || '';
  }

  function getToken()    { return localStorage.getItem(STORAGE_KEY) || ''; }
  function getCompany()  { return localStorage.getItem(COMPANY_KEY) || ''; }

  /* ── UI helpers ─────────────────────────────────────────────────────── */
  function setMsg(id, text, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'ep-msg ' + (type || 'error');
    el.textContent = text;
    el.style.display = text ? 'block' : 'none';
  }

  function setBtn(id, loading) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label || btn.textContent;
  }

  /* ── Tab switcher ───────────────────────────────────────────────────── */
  window.switchEpTab = function (tab) {
    document.getElementById('epRegisterForm').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('epLoginForm').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('epTabRegister').classList.toggle('active', tab === 'register');
    document.getElementById('epTabLogin').classList.toggle('active', tab === 'login');
  };

  /* ── Register ───────────────────────────────────────────────────────── */
  window.registerEmployer = async function () {
    const company  = document.getElementById('epRegCompany')?.value.trim();
    const email    = document.getElementById('epRegEmail')?.value.trim();
    const password = document.getElementById('epRegPassword')?.value;
    const industry = document.getElementById('epRegIndustry')?.value;
    const website  = document.getElementById('epRegWebsite')?.value.trim();

    if (!company)  return setMsg('epRegMsg', 'Company name is required.');
    if (!email)    return setMsg('epRegMsg', 'Work email is required.');
    if (!password || password.length < 8) return setMsg('epRegMsg', 'Password must be at least 8 characters.');
    if (!industry) return setMsg('epRegMsg', 'Please select an industry.');

    setBtn('epRegBtn', true);
    setMsg('epRegMsg', '');

    try {
      const res = await fetch(apiBase() + '/api/employers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, email, password, industry, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Registration failed.');
      setMsg('epRegMsg', '✅ Account created! Signing you in…', 'success');
      setTimeout(() => doLogin(email, password), 800);
    } catch (err) {
      setMsg('epRegMsg', err.message);
    } finally {
      setBtn('epRegBtn', false);
    }
  };

  /* ── Login ──────────────────────────────────────────────────────────── */
  window.loginEmployer = async function () {
    const email    = document.getElementById('epLoginEmail')?.value.trim();
    const password = document.getElementById('epLoginPassword')?.value;
    if (!email || !password) return setMsg('epLoginMsg', 'Email and password are required.');
    setBtn('epLoginBtn', true);
    setMsg('epLoginMsg', '');
    await doLogin(email, password);
    setBtn('epLoginBtn', false);
  };

  async function doLogin(email, password) {
    try {
      const res = await fetch(apiBase() + '/api/employers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Login failed. Check your email and password.');
      localStorage.setItem(STORAGE_KEY, data.token);
      localStorage.setItem(COMPANY_KEY, data.company || '');
      showDashboard(data.company);
      loadMyJobs();
    } catch (err) {
      setMsg('epLoginMsg', err.message);
    }
  }

  /* ── Show / hide dashboard ──────────────────────────────────────────── */
  function showDashboard(company) {
    document.getElementById('epAuthPanel').style.display = 'none';
    document.getElementById('epDashboard').classList.add('visible');
    const badge = document.getElementById('epCompanyBadge');
    if (badge) badge.textContent = company || getCompany() || 'Your Company';
  }

  /* ── Post a job ─────────────────────────────────────────────────────── */
  window.postJob = async function () {
    const title       = document.getElementById('postTitle')?.value.trim();
    const location    = document.getElementById('postLocation')?.value.trim();
    const type        = document.getElementById('postType')?.value;
    const salary      = document.getElementById('postSalary')?.value.trim();
    const link        = document.getElementById('postLink')?.value.trim();
    const closing     = document.getElementById('postClosing')?.value;
    const description = document.getElementById('postDescription')?.value.trim();

    if (!title)       return setMsg('epPostMsg', 'Job title is required.');
    if (!location)    return setMsg('epPostMsg', 'Location is required.');
    if (!salary)      return setMsg('epPostMsg', 'Salary range is required.');
    if (!description) return setMsg('epPostMsg', 'Job description is required.');

    setBtn('epPostBtn', true);
    setMsg('epPostMsg', '');

    try {
      const res = await fetch(apiBase() + '/api/employers/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
        },
        body: JSON.stringify({ title, location, type, salary, link, closing, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to post job.');

      setMsg('epPostMsg', '✅ Job posted successfully! It is now live on RoleRocket AI.', 'success');
      // Clear the form
      ['postTitle','postLocation','postSalary','postLink','postClosing','postDescription'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('postType').value = 'Full-Time';
      loadMyJobs();
    } catch (err) {
      setMsg('epPostMsg', err.message);
    } finally {
      setBtn('epPostBtn', false);
    }
  };

  /* ── Load employer's posted jobs ────────────────────────────────────── */
  window.loadMyJobs = async function () {
    const list = document.getElementById('epJobsList');
    if (!list) return;
    list.innerHTML = '<p class="ep-empty">Loading…</p>';

    try {
      const res = await fetch(apiBase() + '/api/employers/jobs', {
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs.');
      const jobs = Array.isArray(data) ? data : (data.jobs || []);
      if (!jobs.length) {
        list.innerHTML = '<p class="ep-empty">No active listings yet. Post your first job above.</p>';
        return;
      }
      list.innerHTML = jobs.map(j => `
        <div class="ep-job-card">
          <div class="ep-job-info">
            <h4>${esc(j.title)}</h4>
            <div class="ep-job-meta">
              <span>📍 ${esc(j.location)}</span>
              <span class="ep-job-badge">${esc(j.type || 'Full-Time')}</span>
              ${j.salary ? `<span>💰 ${esc(j.salary)}</span>` : ''}
              ${j.closing ? `<span>📅 Closes ${new Date(j.closing).toLocaleDateString('en-JM', {day:'numeric',month:'short',year:'numeric'})}</span>` : ''}
              <span style="color:#475569;">Posted ${timeAgo(j.createdAt)}</span>
            </div>
          </div>
          <button class="ep-delete-btn" onclick="deleteJob('${j._id}')">Remove</button>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p class="ep-empty" style="color:#f87171;">${esc(err.message)}</p>`;
    }
  };

  /* ── Delete a job ───────────────────────────────────────────────────── */
  window.deleteJob = async function (jobId) {
    if (!confirm('Remove this job listing? This cannot be undone.')) return;
    try {
      const res = await fetch(apiBase() + '/api/employers/jobs/' + encodeURIComponent(jobId), {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + getToken() },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Delete failed.');
      }
      loadMyJobs();
    } catch (err) {
      alert('Could not remove listing: ' + err.message);
    }
  };

  /* ── Logout ─────────────────────────────────────────────────────────── */
  window.logoutEmployer = function () {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(COMPANY_KEY);
    location.reload();
  };

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30)  return days + ' days ago';
    const months = Math.floor(days / 30);
    return months + (months === 1 ? ' month ago' : ' months ago');
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Mobile nav
    const menuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebarNav');
    const overlay = document.getElementById('sidebarOverlay');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        const open = sidebar.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open);
        if (overlay) overlay.classList.toggle('open', open);
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        menuBtn?.setAttribute('aria-expanded', 'false');
        overlay.classList.remove('open');
      });
    }

    // If employer token exists, go straight to dashboard
    const token = getToken();
    if (token) {
      showDashboard(getCompany());
      loadMyJobs();
    }

    // Store initial button labels
    ['epRegBtn','epLoginBtn','epPostBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.dataset.label = btn.textContent;
    });
  });
})();
