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

function buildLocalGeneratedEmail(scenario, tone) {
  const scenarioText = buildScenarioText(scenario);
  const toneLabel = titleCase(tone || 'professional');

  return [
    'Hello Hiring Team,',
    `I am writing regarding ${scenarioText}. I appreciate your time and wanted to share a thoughtful message that reflects both professionalism and genuine interest. I have been intentional about how I communicate during this process, and I wanted this note to be clear, respectful, and action-oriented.`,
    `From my perspective, strong communication should create confidence and keep momentum moving forward. In a ${toneLabel} tone, I want to reinforce that I am engaged, prepared, and serious about finding the right opportunity where I can contribute quickly and effectively. I value teams that move with clarity, collaboration, and accountability.`,
    'If helpful, I would be glad to provide any additional details or context to support next steps. Thank you again for your time and consideration. I look forward to hearing from you and hope we can continue the conversation soon.',
    'Best regards,\nYour Name'
  ].join('\n\n');
}

function buildLocalRewrittenEmail(emailContent, scenario, tone) {
  const toneLabel = titleCase(tone || 'professional');
  const lines = String(emailContent || '').trim().split(/\n+/).filter(Boolean);
  const compact = lines.join(' ').replace(/\s+/g, ' ').trim();
  const scenarioText = buildScenarioText(scenario);

  return [
    'Hello Hiring Team,',
    `${compact} I wanted to share a cleaner and more polished version of this message while keeping the original intent intact.`,
    `In a ${toneLabel} tone, my goal is to keep this focused and respectful while making sure the request is clear. This note is specifically for ${scenarioText}, and I hope it communicates both professionalism and strong interest.`,
    'Thank you for your time and consideration. I appreciate your review and look forward to any updates on next steps.',
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
