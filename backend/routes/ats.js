const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { runATSAnalysis } = require('../services/atsScorer');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// POST /api/ats/analyze
router.post('/analyze', authenticateToken, async (req, res) => {
  const { jobDescription, resume, mode } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });
  try {
    const normalizedMode = mode === 'basic' ? 'basic' : 'true-like';
    const analysis = runATSAnalysis(jobDescription, resume, { mode: normalizedMode });
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ats/rewrite
router.post('/rewrite', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OpenAI API key not set' });
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1800,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `You are an ATS resume optimization specialist.

Rewrite the candidate's resume to better match the target job description while preserving facts.

Rules:
- Do not invent employers, titles, dates, degrees, certifications, or tools not supported by the source resume.
- Keep the candidate's actual contact details exactly as provided.
- Improve clarity, keyword alignment, and bullet strength.
- Prefer action + scope + measurable result phrasing.
- Keep the output plain text and ready to paste into a resume editor.
- Preserve section structure when present.
- Return only the rewritten resume text.`
        },
        { role: 'user', content: `Job Description:\n${jobDescription}\nResume:\n${resume}` }
      ]
    });
    const rewritten = completion.choices[0].message.content || '';
    res.json({ rewritten });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
