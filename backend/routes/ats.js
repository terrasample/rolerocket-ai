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
      max_tokens: 2500,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are an elite ATS resume strategist. Your job is to aggressively rewrite the candidate's resume for maximum keyword match and ATS pass-through against the target job description.

Rewrite rules — follow all of them:
1. NEVER invent employers, dates, degrees, certifications, or tools not in the source resume.
2. Keep contact details exactly as provided.
3. AGGRESSIVELY rewrite every experience bullet: lead with a strong action verb, incorporate exact JD terminology, add scope/scale/impact, and quantify results wherever the source gives any numeric signal (budget, team size, revenue, timelines, headcount, etc.).
4. UPLEVEL job titles on older or adjacent roles to better align with the target title if the described work justifies it (e.g. "Project Manager" → "Technical Program Manager" when program-level scope is evident). Do not uplevel if the work clearly does not support it.
5. MAXIMIZE keyword density in bullets by using the exact phrases from the job description (program governance, risk registers, program charters, stakeholder management, change management, Agile, Waterfall, KPIs, roadmaps, etc.) naturally embedded in real accomplishment sentences.
6. REWRITE Core Skills / Skills section into 3–5 ATS-optimized keyword cluster categories that mirror the JD's competency areas (e.g. Program & Project Management, Metrics & Operations, Stakeholder Communications, Tools & Technical). Do not keep a flat interpersonal/technical split.
7. SIMPLIFY Education dates to graduation dates only (not enrollment ranges) unless the degree is in progress.
8. ORDER experience with the most relevant/senior roles first; deprioritize non-primary roles (e.g. reserve/part-time) to the end.
9. Keep output in clean plain text ready to paste into a resume editor. Use consistent formatting with clear section headers.
10. Return only the rewritten resume — no commentary, no markdown fences.`
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
      max_tokens: 4500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert ATS analyst and resume coach. Analyze the candidate's resume against the job description and return a JSON object with exactly these fields:

- "jobTitle": string — concise job title extracted from the job description (e.g. "Google Cloud Technical Program Manager")
- "matchedPairs": array of objects {resumeTerm, jdTerm} — semantic matches where "resumeTerm" is the actual phrase/evidence found in the resume and "jdTerm" is the corresponding JD requirement it satisfies. Maximum 12 pairs. Focus on meaningful, specific matches.
- "missingKeywords": array of objects {keyword, reason} — important JD requirements absent from the resume. "keyword" is concise (1-6 words). "reason" is a brief, specific explanation of why it matters or why it's missing (e.g. "title mismatch — resume says Project Manager", "never mentioned", "not present"). Sort must-have/critical items first. Maximum 15 items.
- "rewrittenResume": string — aggressive ATS-optimized resume rewrite following ALL of these rules: (a) preserve facts — employers, dates, degrees, certs; never invent credentials; (b) rewrite every bullet with a strong action verb + exact JD terminology + quantified impact; (c) uplevel job titles on older/adjacent roles if the work described justifies alignment with the target title; (d) maximize keyword density using exact phrases from the JD naturally embedded in accomplishment sentences; (e) replace flat skills list with 3–5 ATS keyword cluster categories mirroring JD competency areas; (f) simplify education dates to graduation dates only; (g) order experience with most relevant/senior roles first.
- "keyChanges": array of strings — 6-8 specific, concrete changes made in the rewrite (e.g. exact title changes, keyword insertions, bullet transformations, skills restructuring). Be precise.

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
