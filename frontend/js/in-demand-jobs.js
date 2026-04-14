document.addEventListener('DOMContentLoaded', async function () {
  const jobsContainer = document.getElementById('jobsByIndustry');
  const jobsMeta = document.getElementById('jobsByIndustryMeta');
  const jobsError = document.getElementById('jobsByIndustryError');

  const homepageTierHighlights = {
    pro: [
      'ATS Optimizer',
      'Job Market Radar',
      'Application Quality Score',
      'Resume Optimizer'
    ],
    premium: [
      'Interview Prep',
      '1-Click Apply Queue',
      'AI Portfolio Builder',
      'AI Reference Generator'
    ],
    elite: [
      'Career Coach',
      'Career Path Simulator',
      'Offer Negotiation Coach',
      'Video Interview Practice'
    ]
  };

  const tierToneByIndustry = {
    Technology: 'pro',
    Healthcare: 'premium',
    Finance: 'elite',
    Education: 'pro',
    Manufacturing: 'premium',
    Retail: 'elite'
  };

  function renderTierHighlights() {
    Object.entries(homepageTierHighlights).forEach(([tier, features]) => {
      const list = document.getElementById(`${tier}TierHighlights`);
      if (!list) {
        return;
      }

      list.innerHTML = features.map((feature) => `<li>${feature}</li>`).join('');
    });
  }

  function renderJobs(industries) {
    if (!jobsContainer) {
      return;
    }

    jobsContainer.innerHTML = '';
    Object.entries(industries).forEach(([industry, jobs]) => {
      const article = document.createElement('article');
      article.className = `marketing-card tier-feature ${tierToneByIndustry[industry] || 'premium'}`;
      article.innerHTML = `
        <h4>${industry}</h4>
        <ul>${jobs.map((job) => `<li>${job}</li>`).join('')}</ul>
      `;
      jobsContainer.appendChild(article);
    });
  }

  function formatUpdatedDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return 'Updated recently';
    }

    return `Updated daily from live job sources. Last refresh: ${date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`;
  }

  renderTierHighlights();

  if (!jobsContainer) {
    return;
  }

  try {
    const response = await fetch('/api/in-demand-jobs', { cache: 'no-store' });
    const data = await response.json();
    renderJobs(data.industries || {});
    if (jobsMeta) {
      jobsMeta.textContent = formatUpdatedDate(data.updatedAt);
    }
    if (jobsError) {
      jobsError.style.display = 'none';
      jobsError.textContent = '';
    }
  } catch (error) {
    if (jobsError) {
      jobsError.style.display = 'block';
      jobsError.textContent = 'Live job trends are temporarily unavailable. Please check back shortly.';
    }
  }
});