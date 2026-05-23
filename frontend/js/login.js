// ============================================================================
// CINEMATIC COUNTDOWN OVERLAY
// ============================================================================

function initCinematicCountdown() {
  const overlay = document.getElementById('loginCinematicOverlay');
  const countDisplay = document.getElementById('loginCinematicCount');
  const replayBtn = document.getElementById('loginCinematicReplay');

  if (!overlay || !countDisplay) return;

  function playCinematic() {
    overlay.removeAttribute('hidden');
    overlay.classList.remove('reveal', 'launch');
    countDisplay.textContent = '3';
    let count = 3;

    // Reveal the overlay (fade in black background)
    overlay.offsetHeight; // Force reflow
    overlay.classList.add('reveal');

    // Countdown: 3 -> 2 -> 1 -> 0, then launch
    const countdownInterval = setInterval(() => {
      count--;
      if (count >= 0) {
        countDisplay.textContent = count;
      }
      if (count < 0) {
        clearInterval(countdownInterval);
        // Trigger the rocket launch animation
        overlay.classList.add('launch');
        // Hide overlay after animation completes
        setTimeout(() => {
          overlay.setAttribute('hidden', '');
          replayBtn.removeAttribute('hidden');
        }, 5400);
      }
    }, 1000);
  }

  // Play cinematic on page load
  playCinematic();

  // Replay button functionality
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      replayBtn.setAttribute('hidden', '');
      playCinematic();
    });
  }
}

// Initialize cinematic when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCinematicCountdown);
} else {
  initCinematicCountdown();
}

// ============================================================================
// LOGIN FORM
// ============================================================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      // Persist token in both storage scopes to survive stricter WebView privacy modes.
      try {
        localStorage.setItem('token', data.token);
      } catch (storageErr) {
        console.warn('localStorage set failed on login:', storageErr);
      }
      try {
        sessionStorage.setItem('token', data.token);
      } catch (storageErr) {
        console.warn('sessionStorage set failed on login:', storageErr);
      }
      window.location.href = 'index.html';
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    console.error(err);
    alert('Something went wrong. Check console.');
  }
});
