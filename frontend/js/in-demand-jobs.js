// Fetch and render the 5 most in-demand jobs by industry, updating daily
document.addEventListener('DOMContentLoaded', async function () {
  const container = document.getElementById('jobsByIndustry');
  if (!container) return;
  try {
    // Example API endpoint for daily jobs (replace with real endpoint if available)
    const res = await fetch('/api/in-demand-jobs');
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      // fallback static data
      data = {
        Technology: ["Software Engineer","Data Scientist","Cloud Architect","Cybersecurity Analyst","DevOps Engineer"],
        Healthcare: ["Registered Nurse","Medical Technologist","Physical Therapist","Healthcare Administrator","Pharmacist"],
        Finance: ["Financial Analyst","Accountant","Risk Manager","Investment Banker","Compliance Officer"],
        Education: ["Teacher","Instructional Designer","School Counselor","Special Education Specialist","Education Administrator"],
        Manufacturing: ["Production Supervisor","Quality Control Inspector","Industrial Engineer","Maintenance Technician","Supply Chain Analyst"],
        Retail: ["Store Manager","Merchandiser","Inventory Analyst","Customer Experience Lead","Loss Prevention Specialist"]
      };
    }
    container.innerHTML = '';
    Object.entries(data).forEach(([industry, jobs]) => {
      const card = document.createElement('div');
      card.style.background = 'linear-gradient(135deg,#0ea5e9 0%,#1e293b 100%)';
      card.style.borderRadius = '18px';
      card.style.padding = '22px 28px';
      card.style.margin = '8px';
      card.style.minWidth = '220px';
      card.style.maxWidth = '260px';
      card.style.flex = '1 1 220px';
      card.style.boxShadow = '0 2px 12px #2563eb30';
      card.innerHTML = `<h4 style='color:#fff;font-size:1.1em;margin-bottom:10px;'>${industry}</h4><ul style='color:#fff;text-align:left;padding-left:18px;'>${jobs.map(j=>`<li>${j}</li>`).join('')}</ul>`;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = '<div style="color:#dc2626;">Could not load jobs data.</div>';
  }
});