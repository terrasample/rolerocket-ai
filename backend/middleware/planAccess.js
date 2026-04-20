// Middleware to check user plan/tier for feature access
const plans = {
  free: 0,
  pro: 1,
  premium: 2,
  elite: 3
};

// Map feature to minimum plan required
const featurePlanMap = {
  'ats-optimizer': 'pro',
  'job-market-radar': 'pro',
  'application-quality-score': 'pro',
  'resume-optimizer': 'pro',
  'gamification': 'pro',
  'interview-prep': 'premium',
  'one-click-apply': 'premium',
  'ai-portfolio-builder': 'premium',
  'networking-ai': 'premium',
  'ai-reference-generator': 'premium',
  'career-coach': 'elite',
  'career-path-simulator': 'elite',
  'offer-negotiation-coach': 'elite',
  'video-interview-practice': 'elite',
  'calendar-task-ai': 'elite',
  'ai-application-tracker': 'elite',
  'ai-job-agent': 'elite',
  'learning': 'elite',
  'interview-assist': 'elite',
  'outcome-command-center': 'elite'
};

function getUserPlan(req) {
  // Example: req.user.plan, fallback to 'free'
  return (req.user && req.user.plan) ? String(req.user.plan).toLowerCase() : 'free';
}

function planAccess(feature) {
  return (req, res, next) => {
    const userPlan = getUserPlan(req);
    const requiredPlan = featurePlanMap[feature] || 'free';
    if (plans[userPlan] >= plans[requiredPlan]) {
      return next();
    }
    return res.status(403).json({ error: `Upgrade to ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} to access this feature.` });
  };
}

module.exports = planAccess;
