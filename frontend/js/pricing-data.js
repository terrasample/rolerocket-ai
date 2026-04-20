window.RoleRocketPricingData = {
  candidatePlans: {
    free: {
      features: [
        'Resume Generator',
        'Cover Letter Generator',
        'Job Search & Tracking'
      ]
    },
    pro: {
      features: [
        'Everything in Free',
        'ATS Optimizer',
        'Resume Optimizer',
        'Application Quality Score',
        'Job Market Radar',
        'Gamification'
      ]
    },
    premium: {
      features: [
        'Everything in Pro',
        'Interview Prep',
        '1-Click Apply Queue',
        'AI Portfolio Builder',
        'Networking AI',
        'AI Reference Generator'
      ]
    },
    elite: {
      features: [
        'Everything in Premium',
        'RoleRocketAI Learning',
        '🎤 Interview Assist (LIVE)',
        'Career Coach',
        'Career Path Simulator',
        'Offer Negotiation Coach',
        'Video Interview Practice',
        'Calendar & Task AI',
        'AI Application Tracker',
        'AI Job Agent',
        'Outcome Command Center'
      ]
    }
  },
  recruiterPlans: {
    recruiter: {
      features: [
        'Top 3 candidate ranking by job role',
        'Resume match scoring',
        'Premium recruiter dashboard',
        'Unlock advanced recruiter tools'
      ]
    },
    recruiterLifetime: {
      features: [
        'All Recruiter Assist features',
        'Lifetime access',
        'Priority support'
      ]
    }
  },
  lifetimeOffer: {
    limitedPriceHtml: '<span class="price-original">$350</span> $299<span> one-time</span>',
    standardPriceHtml: '$350<span> one-time</span>',
    limitedNoteTemplate: (remaining) => `Limited offer: $299 for the first 50 customers. ${remaining} spots left.`,
    standardNote: 'Limited offer sold out. Lifetime is now $350 one-time.'
  }
};