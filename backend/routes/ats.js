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

// POST /api/ats/full-analysis
router.post('/full-analysis', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OpenAI API key not set' });

  try {
    // Rule-based scorer provides the numeric score and bullet/flag data
    const ruleAnalysis = runATSAnalysis(jobDescription, resume, { mode: 'true-like' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 3500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert ATS analyst and resume coach. Analyze the candidate's resume against the job description and return a JSON object with exactly these fields:

- "jobTitle": string — concise job title extracted from the job description (e.g. "Google Cloud Technical Program Manager")
- "matchedPairs": array of objects {resumeTerm, jdTerm} — semantic matches where "resumeTerm" is the actual phrase/evidence found in the resume and "jdTerm" is the corresponding JD requirement it satisfies. Maximum 12 pairs. Focus on meaningful, specific matches.
- "missingKeywords": array of objects {keyword, reason} — important JD requirements absent from the resume. "keyword" is concise (1-6 words). "reason" is a brief, specific explanation of why it matters or why it's missing (e.g. "title mismatch — resume says Project Manager", "never mentioned", "not present"). Sort must-have/critical items first. Maximum 15 items.
- "rewrittenResume": string — full ATS-optimized resume rewrite. Preserve all facts: employers, titles, dates, degrees, certifications. Do not invent credentials. Improve keyword alignment, bullet strength, and JD terminology.
- "keyChanges": array of strings — 6-8 specific, numbered changes made in the rewrite. Be precise and concrete.

Return ONLY valid JSON with no markdown wrapping.`
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nResume:\n${resume}`
        }
      ]
    });

    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0].message.content || '{}');
    } catch (_) {
      return res.status(500).json({ error: 'AI returned malformed response. Please try again.' });
    }

    res.json({
      jobTitle: String(parsed.jobTitle || ''),
      matchedPairs: Array.isArray(parsed.matchedPairs) ? parsed.matchedPairs : [],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
      rewrittenResume: String(parsed.rewrittenResume || ''),
      keyChanges: Array.isArray(parsed.keyChanges) ? parsed.keyChanges : [],
      atsScore: ruleAnalysis.atsScore,
      scoreBreakdown: ruleAnalysis.scoreBreakdown,
      analysisMode: ruleAnalysis.analysisMode,
      redFlags: ruleAnalysis.redFlags,
      bulletScores: ruleAnalysis.bulletScores
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
