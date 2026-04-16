function extractReferralCode(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, window.location.origin);
    const ref = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('referralCode');
    if (ref) return String(ref).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 40);
  } catch {
    // Value is not a URL.
  }

  return raw.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 40);
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const referralCode = extractReferralCode(document.getElementById('signupReferral').value);

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, referralCode })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } else {
      alert(data.error || 'Signup failed');
    }
  } catch (err) {
    console.error(err);
    alert('Something went wrong. Check console.');
  }
});

