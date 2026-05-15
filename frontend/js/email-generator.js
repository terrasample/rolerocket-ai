// Email Generator JS - Frontend Logic

let currentSelectedTone = 'professional';
let currentEmailOutput = '';

function getEmailApiBase() {
  return typeof getApiBase === 'function' ? getApiBase() : '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Set first tone as selected
  selectTone('professional');
});

// Select tone
function selectTone(tone) {
  // Remove selected class from all tone options
  document.querySelectorAll('.tone-option').forEach(el => {
    el.classList.remove('selected');
  });

  // Add selected class to clicked tone
  document.querySelector(`[data-tone="${tone}"]`).classList.add('selected');
  currentSelectedTone = tone;
}

// Generate email
async function generateEmail() {
  const emailContent = document.getElementById('emailContent').value.trim();
  const scenario = document.getElementById('emailScenario').value;

  // Validate input
  if (!emailContent) {
    showEmailError('Please enter an email to rewrite.');
    return;
  }

  if (emailContent.length < 20) {
    showEmailError('Please enter a longer email (at least 20 characters).');
    return;
  }

  // Show loading state
  const generateBtn = document.getElementById('emailGenerateBtn');
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
        scenario
      })
    });

    const data = await response.json();

    if (response.status === 403) {
      // Access denied - not PRO tier
      showEmailError('Email Assistant is a PRO feature. Upgrade your plan to unlock unlimited email rewrites.');
    } else if (!response.ok) {
      showEmailError(data.error || 'Failed to rewrite email. Please try again.');
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
