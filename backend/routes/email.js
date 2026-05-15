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

// POST /api/email/generate - Generate or rewrite email (PRO+ only)
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { emailContent, tone, scenario, mode } = req.body;
    const user = req.user;

    // Tier check: Email Assistant is a PRO+ feature
    if (!hasProTier(user)) {
      return res.status(403).json({
        error: 'Email Assistant is a PRO feature. Please upgrade your plan to access this feature.',
        code: 'FEATURE_REQUIRES_PRO',
        requiredPlan: 'pro'
      });
    }

    // Validate tone
    if (!tone || !TONE_DESCRIPTIONS[tone]) {
      return res.status(400).json({ error: 'Invalid tone selected' });
    }

    // Determine mode
    const actualMode = mode || (emailContent ? 'rewrite' : 'generate');

    // Validate input based on mode
    if (actualMode === 'rewrite') {
      if (!emailContent || typeof emailContent !== 'string') {
        return res.status(400).json({ error: 'Email content is required for rewrite mode' });
      }
      if (emailContent.length < 20) {
        return res.status(400).json({ error: 'Email content must be at least 20 characters' });
      }
    }

    // Get scenario context
    const scenarioInfo = SCENARIO_TEMPLATES[scenario] || SCENARIO_TEMPLATES.custom;

    // Build system prompt based on mode
    let systemPrompt;

    if (actualMode === 'generate') {
      systemPrompt = `You are an expert professional email writer. Write a complete, polished job-search email ready to send immediately.

Scenario: ${scenarioInfo.context}
Tone: ${TONE_DESCRIPTIONS[tone]}
Special Instructions: ${scenarioInfo.guidance}

Tone differentiation rules:
- Professional: formal, precise, no contractions, executive-level language.
- Warm: friendly and human, natural contractions, supportive and appreciative language.
- Confident: direct and assertive, outcome-focused, clear ask.
- Concise: shortest clear version, no filler.
- Follow-up: polite persistence and momentum.
- Cold-outreach: value-first pitch and specific call to action.

Requirements:
- Exactly 2 body paragraphs (not 3 or 4)
- Include a greeting line and a closing signature line
- No placeholders like [Name] or [Company]
- 130-200 words total
- Make the tone clearly distinguishable from other tones
- Return only the finished email text`;
    } else {
      systemPrompt = `You are an expert email editor. Take this rough email and make it concise, punchy, and professional while preserving the original intent.

Scenario: ${scenarioInfo.context}
Tone: ${TONE_DESCRIPTIONS[tone]}
Special Instructions: ${scenarioInfo.guidance}

Requirements:
- Cut unnecessary words and filler
- Fix grammar, punctuation, and tone
- Keep similar length or shorter than original
- Maintain the original message and personality
- Make it more impactful and clear
- Include proper greeting/closing if missing
- Output exactly 2 body paragraphs
- Make tone differences obvious (Professional vs Warm should not read the same)

Original email:
${emailContent}`;
    }

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
      max_tokens: 800
    });

    const result = response.choices[0].message.content.trim();

    // Return result
    res.json({
      result,
      mode: actualMode
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
      error: 'Failed to generate email. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
