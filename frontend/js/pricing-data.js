window.RoleRocketPricingData = {
  candidatePlans: {
    free: {
      features: [
        'Resume Generator',
        'Cover Letter Generator',
        'Find, Search & Track'
      ]
    },
    pro: {
      features: [
        'Everything in Free',
        'Resume Optimizer',
        'Application Quality Score'
      ]
    },
    premium: {
      features: [
        'Everything in Pro',
        'Applicant Tracking System (ATS) Optimizer',
        'Interview Prep',
        '1-Click Apply Queue',
        'AI Career Brand Kit (Portfolio + References)',
        'Networking AI',
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
    limitedPriceHtml: '<span class="price-original">$499</span> $299<span> one-time</span>',
    standardPriceHtml: '$499<span> one-time</span>',
    limitedNoteTemplate: (remaining) => `Limited offer: $299 for the first 50 customers. ${remaining} spots left.`,
    standardNote: 'Limited offer sold out. Lifetime is now $499 one-time.',
  }
};