const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const OpenAI = require('openai');
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set in environment variables');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

router.post('/generate', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a professional cover letter writer.' },
        { role: 'user', content: `Job Description:\n${jobDescription}\nResume:\n${resume}` }
      ]
    });

    res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;