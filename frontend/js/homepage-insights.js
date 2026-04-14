document.addEventListener('DOMContentLoaded', function () {
  const insightsWrap = document.getElementById('jobSeekerInsights');
  const meta = document.getElementById('jobSeekerInsightsMeta');
  if (!insightsWrap || !meta) {
    return;
  }

  const dailyInsightGroups = [
    [
      {
        tier: 'pro',
        title: 'Where response rates are opening up',
        body: 'Hybrid roles in major hiring hubs are still drawing fewer applicants than fully remote jobs, especially when the company asks for office presence two or three days a week.'
      },
      {
        tier: 'premium',
        title: 'What recruiters notice first',
        body: 'The fastest scan still starts with title alignment, measurable outcomes, and whether your first few bullets match the role mandate without fluff.'
      },
      {
        tier: 'elite',
        title: 'How stronger candidates are applying',
        body: 'The best-performing applicants are sending fewer total applications, but each one is more tailored across resume, portfolio, and interview narrative.'
      }
    ],
    [
      {
        tier: 'pro',
        title: 'Which skills are breaking ties',
        body: 'Hiring teams keep favoring candidates who show practical AI, analytics, or automation usage inside real business work instead of listing tools without outcomes.'
      },
      {
        tier: 'premium',
        title: 'Why callbacks stall after good resumes',
        body: 'A strong resume still loses momentum when the LinkedIn profile, portfolio, or job narrative does not reinforce the same positioning.'
      },
      {
        tier: 'elite',
        title: 'What improves interview conversion',
        body: 'Candidates are converting more screens by preparing role-specific stories with business context, not generic strengths or broad career summaries.'
      }
    ],
    [
      {
        tier: 'pro',
        title: 'Where speed matters most now',
        body: 'Fresh postings still matter, but speed only helps when your application already matches the role language and surfaces proof in the top section.'
      },
      {
        tier: 'premium',
        title: 'What job seekers are underestimating',
        body: 'Follow-ups are still underused. Short, specific recruiter follow-ups often outperform sending more cold applications into crowded pipelines.'
      },
      {
        tier: 'elite',
        title: 'How top candidates keep momentum',
        body: 'They run a weekly system: target high-fit roles, follow up, prep interviews early, and cut low-probability effort before it drains the week.'
      }
    ]
  ];

  const now = new Date();
  const dayIndex = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const activeGroup = dailyInsightGroups[dayIndex % dailyInsightGroups.length];

  insightsWrap.innerHTML = activeGroup.map((item) => `
    <article class="marketing-card tier-feature ${item.tier}">
      <h3>${item.title}</h3>
      <p>${item.body}</p>
    </article>
  `).join('');

  meta.textContent = `Daily refresh: ${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
});