// Email Generator JS - Frontend Logic

let currentMode = 'generate'; // 'generate' or 'rewrite'
let currentSelectedTone = 'professional';
let currentEmailOutput = '';

function getEmailApiBase() {
  return typeof getApiBase === 'function' ? getApiBase() : '';
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
    const response = await fetch(`${getEmailApiBase()}/email/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailContent,
        tone: currentSelectedTone,
        scenario,
        mode
      })
    });

    const data = await response.json();

    if (response.status === 403) {
      // Access denied - not PRO tier
      showEmailError('Email Assistant is a PRO feature. Upgrade your plan to unlock unlimited email rewrites.');
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
