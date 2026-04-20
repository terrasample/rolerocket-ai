const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const OpenAI = require('openai');
const User = require('../models/User');
const { getDailyGenerationStatus, recordDailyGenerationUsage } = require('../services/aiGenerationLimits');
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set in environment variables');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

router.post('/generate', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;
  if (!jobDescription || !resume) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const userId = req.user?.userId || req.user?.id || req.user?._id || req.user?.sub;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const generationStatus = getDailyGenerationStatus(user, 'cover-letter');
    if (!generationStatus.allowed) {
      return res.status(429).json({ error: generationStatus.message });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `
You are a professional cover letter writer.

Write a polished, modern, upload-ready cover letter tailored to the job description.

Rules:
- Use only facts supported by the provided resume and job description.
- Do not invent companies, titles, achievements, dates, or certifications.
- No placeholders like [Company Name], [Hiring Manager], or [Your Name].
- Keep it concise: 3-5 short paragraphs.
- Keep tone confident, specific, and professional.
- End with a strong closing and candidate name if inferable from the resume; otherwise omit name.
- Return plain text only, no markdown code fences.
          `
        },
        { role: 'user', content: `Job Description:\n${jobDescription}\nResume:\n${resume}` }
      ]
    });

    await recordDailyGenerationUsage(user, 'cover-letter');

    res.json({ result: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;