const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const openai = require('openai');

const client = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper: Check if user has PRO+ tier
function hasProTier(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const plan = String(user.plan || 'free').toLowerCase();
  return ['pro', 'premium', 'elite', 'lifetime'].includes(plan);
}

// Email tone descriptions for the system prompt
const TONE_DESCRIPTIONS = {
  professional: 'professional and formal tone, with perfect grammar and business etiquette',
  warm: 'warm, personable, and friendly tone while remaining professional',
  confident: 'confident and direct tone, assertive without being aggressive',
  concise: 'concise and to-the-point tone, removing unnecessary words and fluff',
  'follow-up': 'polite follow-up tone that expresses genuine interest without being pushy',
  'cold-outreach': 'compelling and direct cold outreach tone designed to grab attention'
};

// Scenario templates with guidance
const SCENARIO_TEMPLATES = {
  'thank-you': {
    guidance: 'This is a thank-you email after an interview. Emphasize enthusiasm, key discussion points, and next steps.',
    context: 'Post-interview thank you message'
  },
  'salary-range': {
    guidance: 'This is an email requesting salary range information before applying. Be professional and confident in asking for this information.',
    context: 'Pre-application salary inquiry'
  },
  'decline-offer': {
    guidance: 'This is an email politely declining a job offer. Express gratitude, explain briefly, and leave the door open for future opportunities.',
    context: 'Job offer decline'
  },
  'check-status': {
    guidance: 'This is a follow-up email checking on application status. Be concise, professional, and express continued interest.',
    context: 'Application status inquiry'
  },
  'follow-up': {
    guidance: 'This is a general follow-up email. Keep it relevant, professional, and brief.',
    context: 'General follow-up communication'
  },
  'cold-outreach': {
    guidance: 'This is a cold outreach email to recruiters or hiring managers. Be compelling, briefly mention relevant experience, and include a clear call to action.',
    context: 'Cold outreach to recruiter/hiring manager'
  },
  'custom': {
    guidance: 'Rewrite this email maintaining the original intent and purpose.',
    context: 'Custom email rewrite'
  }
};

// POST /api/email/generate - Generate rewritten email (PRO+ only)
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { emailContent, tone, scenario } = req.body;
    const user = req.user;

    // Tier check: Email Assistant is a PRO+ feature
    if (!hasProTier(user)) {
      return res.status(403).json({
        error: 'Email Assistant is a PRO feature. Please upgrade your plan to access this feature.',
        code: 'FEATURE_REQUIRES_PRO',
        requiredPlan: 'pro'
      });
    }

    // Validate input
    if (!emailContent || typeof emailContent !== 'string') {
      return res.status(400).json({ error: 'Email content is required' });
    }

    if (!tone || !TONE_DESCRIPTIONS[tone]) {
      return res.status(400).json({ error: 'Invalid tone selected' });
    }

    if (emailContent.length < 20) {
      return res.status(400).json({ error: 'Email content must be at least 20 characters' });
    }

    // Get scenario context
    const scenarioInfo = SCENARIO_TEMPLATES[scenario] || SCENARIO_TEMPLATES.custom;

    // Build system prompt
    const systemPrompt = `You are an expert email writer specializing in professional job search communications. Your task is to rewrite the provided email in a ${TONE_DESCRIPTIONS[tone]}.

Context: ${scenarioInfo.context}
Guidance: ${scenarioInfo.guidance}

Requirements:
- Maintain the original intent and key messages
- Use the specified tone throughout
- Ensure proper grammar and punctuation
- Keep the email concise yet complete
- Make it professional and appropriate for job search context
- Do not include placeholders or brackets like [Name] or [Company]
- Return only the rewritten email body, nothing else

Original email to rewrite:
${emailContent}`;

    // Call OpenAI
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 600
    });

    const rewrittenEmail = response.choices[0].message.content.trim();

    // Return result
    res.json({
      result: rewrittenEmail
    });
  } catch (error) {
    console.error('Error in email generation:', error);

    if (error.code === 'FEATURE_REQUIRES_PRO') {
      return res.status(403).json({
        error: error.message,
        code: 'FEATURE_REQUIRES_PRO'
      });
    }

    res.status(500).json({
      error: 'Failed to rewrite email. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
