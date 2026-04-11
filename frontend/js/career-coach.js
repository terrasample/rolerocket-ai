// Career Coach frontend logic

document.addEventListener('DOMContentLoaded', function () {
  const btn = document.getElementById('careerCoachBtn');
  const roleInput = document.getElementById('careerRole');
  const goalsInput = document.getElementById('careerGoals');
  const resultDiv = document.getElementById('careerCoachResult');

  btn.addEventListener('click', async function () {
    const role = roleInput.value.trim();
    const goals = goalsInput.value.trim();
    if (!role) {
      resultDiv.innerHTML = '<span style="color:#dc2626;">Please enter a target role or path.</span>';
      return;
    }
    resultDiv.innerHTML = 'Generating career coaching advice...';
    try {
      const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/career-coach', {
        method: 'POST',
        headers,
        body: JSON.stringify({ role, goals })
      });
      const data = await res.json();
      if (res.ok && data.result) {
        resultDiv.innerHTML = `<pre style=\"background:#fffbe6;padding:22px 18px;border-radius:12px;max-height:420px;overflow:auto;font-size:1.18em;line-height:1.7;color:#1e293b;font-family:'Inter', 'Segoe UI', Arial, sans-serif;border:2.5px solid #f59e42;box-shadow:0 2px 16px #facc1530;\">${data.result}</pre>`;
      } else {
        resultDiv.innerHTML = `<span style=\"color:#dc2626;\">${data.error || 'Failed to generate advice.'}</span>`;
      }
    } catch (err) {
      resultDiv.innerHTML = '<span style="color:#dc2626;">Error generating advice.</span>';
    }
  });
});
