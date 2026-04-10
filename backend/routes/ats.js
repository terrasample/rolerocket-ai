const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { runATSAnalysis } = require('../services/atsScorer');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// POST /api/ats/analyze
router.post('/analyze', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });
  try {
    const analysis = runATSAnalysis(jobDescription, resume);
    res.json(analysis);
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
      messages: [
        { role: 'system', content: 'Rewrite the resume below to better match the job description. Return only the improved resume text.' },
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
