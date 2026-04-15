// Import resume from dashboard to application form
// Usage: Attach to a button in the application form page

document.addEventListener('DOMContentLoaded', function () {
  const importBtn = document.getElementById('importResumeBtn');
  const resumeTextArea = document.getElementById('resumeText');
  if (importBtn && resumeTextArea) {
    importBtn.addEventListener('click', async function () {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      try {
        const token = typeof getStoredToken === 'function' ? getStoredToken() : localStorage.getItem('token');
        const res = await fetch('/api/resume', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.resumes && data.resumes.length > 0) {
          resumeTextArea.value = data.resumes[0].content;
        } else {
          alert('No resume found in your dashboard.');
        }
      } catch (err) {
        alert('Failed to import resume.');
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Import from Dashboard';
      }
    });
  }
});
