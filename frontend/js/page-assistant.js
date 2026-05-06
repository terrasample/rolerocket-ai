(function (global) {
  const PAGE_CONFIG = {
    'resume-generator.html': {
      title: 'Resume Assistant',
      intro: 'Ask for sharper bullets, better positioning, or quick fixes before you send your resume.',
      placeholder: 'Ask how to strengthen this resume for the target job...',
      suggestions: [
        'What are the top 3 gaps in this resume for the job?',
        'Rewrite my summary to sound stronger.',
        'What keywords am I still missing?'
      ],
      collectContext() {
        return {
          'Target role': getFieldValue('#resumeJobTitleGen'),
          'Company': getFieldValue('#resumeCompanyGen'),
          'Baseline resume': getFieldValue('#resumeBaseGen'),
          'Job description': getFieldValue('#resumeJobDescriptionGen'),
          'Generated output': getTextContent('#resumeOutputGen')
        };
      }
    },
    'resume-optimizer.html': {
      title: 'Resume Assistant',
      intro: 'Use this to tighten wording, close fit gaps, or ask what changed in the rewrite.',
      placeholder: 'Ask how to improve this optimized resume...',
      suggestions: [
        'What should I improve first in this resume?',
        'Rewrite two weak bullets more strongly.',
        'What achievements should I quantify?'
      ],
      collectContext() {
        return {
          'Target role': getFieldValue('#resumeJobTitle'),
          'Company': getFieldValue('#resumeCompany'),
          'Baseline resume': getFieldValue('#resumeBase'),
          'Job description': getFieldValue('#resumeJobDescription'),
          'Generated output': getTextContent('#resumeOutput')
        };
      }
    },
    'cover-letter-generator.html': {
      title: 'Cover Letter Assistant',
      intro: 'Ask for a stronger opening, tighter closing, or clearer alignment to the role.',
      placeholder: 'Ask how to improve this cover letter...',
      suggestions: [
        'Give me a stronger opening paragraph.',
        'How can I sound more specific to this company?',
        'Rewrite the closing to be more confident.'
      ],
      collectContext() {
        return {
          'Target role': getFieldValue('#coverJobTitle'),
          'Company': getFieldValue('#coverCompany'),
          'Baseline resume': getFieldValue('#coverResume'),
          'Job description': getFieldValue('#coverJobDescription'),
          'Generated output': getTextContent('#coverLetterOutput')
        };
      }
    },
    'optimizer.html': {
      title: 'ATS Assistant',
      intro: 'Ask why the score is low, what keywords are missing, or what to rewrite first.',
      placeholder: 'Ask how to improve your ATS match...',
      suggestions: [
        'Why is my ATS score low?',
        'What keywords are missing from my resume?',
        'Which sections should I rewrite first?'
      ],
      collectContext() {
        return {
          'Job description': getFieldValue('#atsJobDescription'),
          'Resume': getFieldValue('#atsResume'),
          'ATS status': getTextContent('#optimizerStatus'),
          'ATS analysis': getTextContent('#optimizerMain')
        };
      }
    },
    'interview-prep-ai.html': {
      title: 'Interview Assistant',
      intro: 'Ask for stronger answers, follow-up questions, or a simpler speaking structure.',
      placeholder: 'Ask how to improve this interview prep...',
      suggestions: [
        'Give me a better STAR answer structure.',
        'Ask me one harder follow-up question.',
        'Make this answer sound more confident.'
      ],
      collectContext() {
        return {
          'Role': getFieldValue('#interviewRole'),
          'Job description': getFieldValue('#interviewJobDescription'),
          'Interview prep output': getTextContent('#interviewPrepResult')
        };
      }
    },
    'course-learning.html': {
      title: 'Course Assistant',
      intro: 'Ask for a simpler explanation, one more example, or a quick practice question.',
      placeholder: 'Ask about the lesson you are viewing...',
      suggestions: [
        'Explain this in simpler language.',
        'Give me one worked example.',
        'Quiz me on this section.'
      ],
      collectContext() {
        return {
          'Topic': new URLSearchParams(global.location.search).get('topic') || '',
          'Course title': getTextContent('#courseTitleMain'),
          'Overview': getTextContent('#courseOverview'),
          'Visible lesson content': getTextContent('#courseModules')
        };
      }
    },
    'dashboard.html': {
      title: 'RoleRocket Assistant',
      intro: 'Ask what to do next, which tool fits your goal, or how to move faster today.',
      placeholder: 'Ask what to do next in RoleRocket AI...',
      suggestions: [
        'What should I do next today?',
        'Which tool should I use first?',
        'How can I move faster toward interviews?'
      ],
      collectContext() {
        return {
          'Dashboard snapshot': getTextContent('main') || getTextContent('body')
        };
      }
    }
  };

  function clip(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function getFieldValue(selector) {
    const element = document.querySelector(selector);
    if (!element) return '';
    return clip('value' in element ? element.value : element.textContent, 2200);
  }

  function getTextContent(selector) {
    const element = document.querySelector(selector);
    if (!element) return '';
    return clip(element.innerText || element.textContent || '', 3500);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getToken() {
    if (typeof global.getStoredToken === 'function') return global.getStoredToken() || '';
    return localStorage.getItem('token')
      || sessionStorage.getItem('token')
      || localStorage.getItem('authToken')
      || sessionStorage.getItem('authToken')
      || '';
  }

  function getEndpoint() {
    if (typeof global.apiUrl === 'function') return global.apiUrl('/api/page-assistant');
    if (global.location.protocol === 'file:') return 'http://localhost:5001/api/page-assistant';
    return '/api/page-assistant';
  }

  function getPageConfig() {
    const fileName = String(global.location.pathname || '').split('/').pop() || '';
    return PAGE_CONFIG[fileName] || null;
  }

  function buildContext(config) {
    const rawContext = typeof config.collectContext === 'function' ? config.collectContext() : {};
    return Object.fromEntries(
      Object.entries(rawContext || {}).filter(([, value]) => String(value || '').trim())
    );
  }

  function injectStyles() {
    if (document.getElementById('rrPageAssistantStyles')) return;
    const style = document.createElement('style');
    style.id = 'rrPageAssistantStyles';
    style.textContent = `
      .rr-assistant-launcher {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 12000;
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        background: linear-gradient(135deg, #0f172a, #1d4ed8);
        color: #fff;
        font: 700 14px/1.1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.28);
        cursor: pointer;
      }
      .rr-assistant-launcher:hover {
        filter: brightness(1.05);
      }
      .rr-assistant-panel {
        position: fixed;
        right: 20px;
        bottom: 78px;
        z-index: 12000;
        width: min(380px, calc(100vw - 24px));
        max-height: min(72vh, 760px);
        display: none;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid #dbe5f0;
        border-radius: 18px;
        box-shadow: 0 28px 64px rgba(15, 23, 42, 0.24);
        overflow: hidden;
      }
      .rr-assistant-panel.is-open {
        display: flex;
      }
      .rr-assistant-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 16px 12px;
        background: linear-gradient(135deg, #0f172a, #1e3a8a);
        color: #fff;
      }
      .rr-assistant-header h3 {
        margin: 0 0 4px;
        font-size: 1rem;
      }
      .rr-assistant-header p {
        margin: 0;
        font-size: 0.87rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.84);
      }
      .rr-assistant-close {
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 1.4rem;
        cursor: pointer;
        line-height: 1;
      }
      .rr-assistant-messages {
        padding: 14px 16px;
        overflow-y: auto;
        background: #f8fafc;
        display: grid;
        gap: 10px;
        flex: 1;
      }
      .rr-assistant-message {
        max-width: 92%;
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 0.95rem;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .rr-assistant-message.user {
        justify-self: end;
        background: #dbeafe;
        color: #1e3a8a;
      }
      .rr-assistant-message.assistant {
        justify-self: start;
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #dbe5f0;
      }
      .rr-assistant-suggestions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 0 16px 12px;
        background: #f8fafc;
      }
      .rr-assistant-chip {
        border: 1px solid #cbd5e1;
        border-radius: 999px;
        padding: 8px 10px;
        background: #fff;
        color: #1e3a8a;
        font-size: 0.82rem;
        cursor: pointer;
      }
      .rr-assistant-composer {
        display: grid;
        gap: 10px;
        padding: 14px 16px 16px;
        border-top: 1px solid #e2e8f0;
        background: #fff;
      }
      .rr-assistant-composer textarea {
        width: 100%;
        min-height: 84px;
        resize: vertical;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 11px 12px;
        font: 400 0.95rem/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #0f172a;
      }
      .rr-assistant-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .rr-assistant-note {
        font-size: 0.78rem;
        color: #64748b;
      }
      .rr-assistant-send {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        background: #2563eb;
        color: #fff;
        font: 700 0.9rem/1 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        cursor: pointer;
      }
      .rr-assistant-send[disabled] {
        opacity: 0.6;
        cursor: wait;
      }
      @media (max-width: 640px) {
        .rr-assistant-panel {
          right: 12px;
          left: 12px;
          bottom: 74px;
          width: auto;
          max-height: 76vh;
        }
        .rr-assistant-launcher {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    const config = getPageConfig();
    if (!config) return;

    injectStyles();

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'rr-assistant-launcher';
    launcher.textContent = 'Ask AI';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('section');
    panel.className = 'rr-assistant-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', config.title);
    panel.innerHTML = `
      <div class="rr-assistant-header">
        <div>
          <h3>${escapeHtml(config.title)}</h3>
          <p>${escapeHtml(config.intro)}</p>
        </div>
        <button type="button" class="rr-assistant-close" aria-label="Close assistant">&times;</button>
      </div>
      <div class="rr-assistant-messages"></div>
      <div class="rr-assistant-suggestions"></div>
      <div class="rr-assistant-composer">
        <textarea placeholder="${escapeHtml(config.placeholder)}"></textarea>
        <div class="rr-assistant-actions">
          <div class="rr-assistant-note">Uses the page you are already working on for context.</div>
          <button type="button" class="rr-assistant-send">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const messagesEl = panel.querySelector('.rr-assistant-messages');
    const suggestionsEl = panel.querySelector('.rr-assistant-suggestions');
    const inputEl = panel.querySelector('textarea');
    const sendBtn = panel.querySelector('.rr-assistant-send');
    const closeBtn = panel.querySelector('.rr-assistant-close');
    const history = [];

    function appendMessage(role, text) {
      const message = document.createElement('div');
      message.className = `rr-assistant-message ${role}`;
      message.textContent = text;
      messagesEl.appendChild(message);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function openPanel() {
      panel.classList.add('is-open');
      launcher.setAttribute('aria-expanded', 'true');
      inputEl.focus();
    }

    function closePanel() {
      panel.classList.remove('is-open');
      launcher.setAttribute('aria-expanded', 'false');
    }

    async function sendMessage(prefilledText) {
      const text = clip(prefilledText || inputEl.value, 1500);
      if (!text) return;

      openPanel();
      appendMessage('user', text);
      inputEl.value = '';
      sendBtn.disabled = true;
      sendBtn.textContent = 'Thinking...';

      const token = getToken();
      if (!token) {
        appendMessage('assistant', 'Please sign in first so I can use your page context.');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
        return;
      }

      try {
        const res = await fetch(getEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            page: config.title,
            message: text,
            context: buildContext(config),
            history
          })
        });

        let data = {};
        try {
          data = await res.json();
        } catch (err) {
          data = {};
        }

        if (!res.ok) {
          throw new Error(data.error || 'Assistant request failed.');
        }

        const answer = clip(data.answer || 'I could not generate a response right now.', 5000);
        history.push({ role: 'user', content: text });
        history.push({ role: 'assistant', content: answer });
        if (history.length > 6) history.splice(0, history.length - 6);
        appendMessage('assistant', answer);
      } catch (err) {
        appendMessage('assistant', err.message || 'Assistant request failed.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      }
    }

    appendMessage('assistant', config.intro);

    (config.suggestions || []).forEach((suggestion) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'rr-assistant-chip';
      chip.textContent = suggestion;
      chip.addEventListener('click', function () {
        sendMessage(suggestion);
      });
      suggestionsEl.appendChild(chip);
    });

    launcher.addEventListener('click', function () {
      if (panel.classList.contains('is-open')) closePanel();
      else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);
    sendBtn.addEventListener('click', function () {
      sendMessage();
    });
    inputEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) closePanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);