// Email Generator JS - Frontend Logic

let currentMode = 'generate'; // 'generate' or 'rewrite'
let currentSelectedTone = 'professional';
let currentEmailOutput = '';

function getEmailApiBase() {
  return typeof getApiBase === 'function' ? getApiBase() : '';
}

function isDemoMode() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('demo') === 'true') return true;
  } catch {
    // ignore
  }

  return window.location.protocol === 'file:';
}

function titleCase(value) {
  const text = String(value || '').replace(/-/g, ' ');
  return text.replace(/\b\w/g, ch => ch.toUpperCase());
}

function buildScenarioText(scenario) {
  const map = {
    'thank-you': 'thanking the hiring team after an interview',
    'salary-range': 'requesting salary range details before applying',
    'decline-offer': 'declining an offer respectfully while keeping the door open',
    'check-status': 'checking in on application status',
    'follow-up': 'sending a professional follow-up',
    'cold-outreach': 'reaching out to a recruiter for potential roles',
    custom: 'sending a professional career-related message'
  };

  return map[scenario] || map.custom;
}

function getToneLead(tone) {
  const map = {
    professional: 'Thank you for your time and consideration.',
    warm: 'I really appreciate your time and the chance to connect.',
    confident: 'I am reaching out with a clear objective and strong interest.',
    concise: 'I am writing with a quick and focused note.',
    'follow-up': 'I wanted to follow up and keep momentum moving on this conversation.',
    'cold-outreach': 'I am reaching out because I can add immediate value to your team.'
  };

  return map[tone] || map.professional;
}

function getToneClose(tone) {
  const map = {
    professional: 'I would welcome the opportunity to discuss next steps at your convenience.',
    warm: 'If helpful, I would love to continue the conversation and share anything else you need.',
    confident: 'If this aligns with your priorities, I am ready to move forward quickly.',
    concise: 'Please let me know the best next step.',
    'follow-up': 'I would appreciate any update you can share on timing and next steps.',
    'cold-outreach': 'If useful, I can send a brief overview of how I can help and suggest a short call.'
  };

  return map[tone] || map.professional;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildLocalGeneratedEmail(scenario, tone) {
  const scenarioText = buildScenarioText(scenario);
  const selectedTone = tone || 'professional';
  const toneLead = getToneLead(selectedTone);
  const toneClose = getToneClose(selectedTone);

  return [
    'Hello Hiring Team,',
    `${toneLead} I am writing regarding ${scenarioText}. I am very interested in opportunities where I can contribute with strong execution, clear communication, and reliable follow-through.`,
    `${toneClose} Thank you again for reviewing my message, and I look forward to hearing from you.`,
    'Best regards,\nYour Name'
  ].join('\n\n');
}

function buildLocalRewrittenEmail(emailContent, scenario, tone) {
  const selectedTone = tone || 'professional';
  const toneLead = getToneLead(selectedTone);
  const toneClose = getToneClose(selectedTone);
  const compact = compactText(emailContent);
  const scenarioText = buildScenarioText(scenario);

  return [
    'Hello Hiring Team,',
    `${toneLead} ${compact} This revision keeps the original intent while making the message cleaner and easier to act on for ${scenarioText}.`,
    `${toneClose} I appreciate your time and look forward to your response.`,
    'Best regards,\nYour Name'
  ].join('\n\n');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set first tone as selected
  selectTone('professional', 'gen');
  switchMode('generate');
});

// Switch between modes
function switchMode(mode) {
  currentMode = mode;
  const generateBtn = document.getElementById('modeGenerateBtn');
  const rewriteBtn = document.getElementById('modeRewriteBtn');
  const generateModeDiv = document.getElementById('generateMode');
  const rewriteModeDiv = document.getElementById('rewriteMode');

  if (mode === 'generate') {
    generateBtn.classList.add('selected');
    rewriteBtn.classList.remove('selected');
    generateModeDiv.style.display = 'flex';
    rewriteModeDiv.style.display = 'none';
    selectTone('professional', 'gen');
  } else {
    generateBtn.classList.remove('selected');
    rewriteBtn.classList.add('selected');
    generateModeDiv.style.display = 'none';
    rewriteModeDiv.style.display = 'flex';
    selectTone('professional', 'rewrite');
  }
  
  // Clear error messages
  document.getElementById('emailErrorMessage').classList.remove('show');
}

// Select tone
function selectTone(tone, modePrefix) {
  // Remove selected class from all tone options in the current mode
  if (modePrefix === 'gen') {
    document.querySelectorAll('#generateMode .tone-option').forEach(el => {
      el.classList.remove('selected');
    });
    document.querySelector(`#generateMode [data-tone="${tone}"]`).classList.add('selected');
  } else {
    document.querySelectorAll('#rewriteMode .tone-option').forEach(el => {
      el.classList.remove('selected');
    });
    document.querySelector(`#rewriteMode [data-tone="${tone}"]`).classList.add('selected');
  }
  currentSelectedTone = tone;
}

// Generate or rewrite email
async function generateEmail(mode) {
  let emailContent = '';
  let scenario = '';

  if (mode === 'generate') {
    scenario = document.getElementById('emailScenarioGen').value;
    // No emailContent needed for generation
  } else {
    emailContent = document.getElementById('emailContent').value.trim();
    scenario = document.getElementById('emailScenarioRewrite').value;

    // Validate input
    if (!emailContent) {
      showEmailError('Please enter an email to rewrite.');
      return;
    }

    if (emailContent.length < 20) {
      showEmailError('Please enter a longer email (at least 20 characters).');
      return;
    }
  }

  // Show loading state
  const generateBtn = mode === 'generate' 
    ? document.getElementById('emailGenerateBtn')
    : document.getElementById('emailRewriteBtn');
  const loadingIndicator = document.getElementById('emailLoadingIndicator');
  const outputArea = document.getElementById('emailOutput');

  generateBtn.disabled = true;
  loadingIndicator.classList.add('show');
  outputArea.classList.add('empty');
  document.getElementById('emailErrorMessage').classList.remove('show');

  try {
    const token = localStorage.getItem('token');
    const demoMode = isDemoMode();

    if (!token && demoMode) {
      currentEmailOutput = mode === 'generate'
        ? buildLocalGeneratedEmail(scenario, currentSelectedTone)
        : buildLocalRewrittenEmail(emailContent, scenario, currentSelectedTone);
      outputArea.textContent = currentEmailOutput;
      outputArea.classList.remove('empty');

      document.getElementById('emailCopyBtn').style.display = 'inline-block';
      document.getElementById('emailDownloadBtn').style.display = 'inline-block';
      document.getElementById('emailSendBtn').style.display = 'inline-block';
      return;
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${getEmailApiBase()}/api/email/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        emailContent,
        tone: currentSelectedTone,
        scenario,
        mode
      })
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { error: `Unexpected response (${response.status}).` };

    if (response.status === 401) {
      showEmailError('Please log in to use Email Assistant.');
    } else if (response.status === 403 && data.code === 'FEATURE_REQUIRES_PRO') {
      // Access denied - not PRO tier
      showEmailError('Email Assistant is a PRO feature. Upgrade your plan to unlock unlimited email rewrites.');
    } else if (response.status === 403) {
      showEmailError('Your session expired. Please log in again.');
    } else if (!response.ok) {
      showEmailError(data.error || 'Failed to generate email. Please try again.');
    } else {
      // Success
      currentEmailOutput = data.result;
      outputArea.textContent = currentEmailOutput;
      outputArea.classList.remove('empty');

      // Show export buttons
      document.getElementById('emailCopyBtn').style.display = 'inline-block';
      document.getElementById('emailDownloadBtn').style.display = 'inline-block';
      document.getElementById('emailSendBtn').style.display = 'inline-block';
    }
  } catch (error) {
    if (isDemoMode()) {
      currentEmailOutput = mode === 'generate'
        ? buildLocalGeneratedEmail(scenario, currentSelectedTone)
        : buildLocalRewrittenEmail(emailContent, scenario, currentSelectedTone);
      outputArea.textContent = currentEmailOutput;
      outputArea.classList.remove('empty');

      document.getElementById('emailCopyBtn').style.display = 'inline-block';
      document.getElementById('emailDownloadBtn').style.display = 'inline-block';
      document.getElementById('emailSendBtn').style.display = 'inline-block';
      return;
    }

    showEmailError('An error occurred. Please try again.');
    console.error('Error:', error);
  } finally {
    generateBtn.disabled = false;
    loadingIndicator.classList.remove('show');
  }
}

// Show error message
function showEmailError(message) {
  const errorEl = document.getElementById('emailErrorMessage');
  errorEl.textContent = '❌ ' + message;
  errorEl.classList.add('show');
}

// Copy email to clipboard
function copyEmailToClipboard() {
  if (!currentEmailOutput) return;

  navigator.clipboard.writeText(currentEmailOutput).then(() => {
    const copyBtn = document.getElementById('emailCopyBtn');
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

// Download email as text file
function downloadEmailAsText() {
  if (!currentEmailOutput) return;

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(currentEmailOutput));
  element.setAttribute('download', 'email.txt');
  element.style.display = 'none';

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// Send email via provider
function sendEmailViaProvider() {
  if (!currentEmailOutput) return;

  // Use mailto: to open default email client with the rewritten email
  const subject = `Job Search Email`;
  const body = encodeURIComponent(currentEmailOutput);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}
