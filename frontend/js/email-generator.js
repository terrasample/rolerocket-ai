// Email Generator JS - Frontend Logic

let currentSelectedTone = 'professional';
let currentEmailOutput = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadEmailStatus();
  
  // Set first tone as selected
  selectTone('professional');
});

// Load email credit status
async function loadEmailStatus() {
  try {
    const response = await fetch(`${API_BASE}/document-credits/status?feature=email-assistant`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to load email status:', response.statusText);
      return;
    }

    const status = await response.json();
    renderEmailCreditStatus(status);
  } catch (error) {
    console.error('Error loading email status:', error);
  }
}

// Render email credit status UI
function renderEmailCreditStatus(status) {
  const freeRemaining = status.freeRemaining || 0;
  const paidCredits = status.paidCredits || 0;

  document.getElementById('emailFreeRemaining').textContent = freeRemaining;
  document.getElementById('emailPaidCredits').textContent = paidCredits;

  const creditStatusEl = document.getElementById('emailCreditStatus');
  const buyPanelEl = document.getElementById('emailBuyPanel');

  if (status.unlimited) {
    creditStatusEl.textContent = '✅ You have unlimited email rewrites (Pro/Premium/Elite plan)';
    buyPanelEl.style.display = 'none';
  } else if (freeRemaining > 0 || paidCredits > 0) {
    creditStatusEl.textContent = `✅ Ready to generate (${freeRemaining > 0 ? 'free' : 'paid'} credits available)`;
    buyPanelEl.style.display = 'none';
  } else {
    creditStatusEl.textContent = `❌ No credits remaining. Purchase more to continue.`;
    creditStatusEl.style.color = '#c33';
    buyPanelEl.style.display = 'grid';
  }
}

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
    const response = await fetch(`${API_BASE}/email/generate`, {
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

    if (response.status === 402) {
      showEmailError('No credits remaining. Please purchase credits to continue.');
      loadEmailStatus(); // Refresh status
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

      // Refresh status
      loadEmailStatus();
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

// Start email checkout
async function startEmailCheckout(bundle) {
  try {
    const response = await fetch(`${API_BASE}/document-credits/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bundle,
        returnPath: '/email-generator.html'
      })
    });

    const data = await response.json();

    if (response.ok && data.url) {
      window.location.href = data.url;
    } else {
      showEmailError('Failed to start checkout. Please try again.');
    }
  } catch (error) {
    showEmailError('An error occurred during checkout. Please try again.');
    console.error('Error:', error);
  }
}
