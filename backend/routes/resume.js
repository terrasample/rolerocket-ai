const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth'); // JWT middleware
const Resume = require('../models/Resume'); // MongoDB model
const OpenAI = require('openai');

// Initialize OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set in environment variables');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ----------------------
// Generate AI Resume
// ----------------------
router.post('/generate', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;

  // Validate input
  if (!jobDescription || !resume) {
    return res.status(400).json({ error: 'jobDescription and resume are required' });
  }

  try {
    // Call OpenAI to generate improved resume
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `
You are a senior resume expert.
Rewrite and improve the resume to match the job description.
Make it:
- Professional
- ATS optimized
- Strong bullet points
- Clear and impactful
Return the full improved resume and a short list of improvements.
          `,
        },
        {
          role: 'user',
          content: `
Job Description:
${jobDescription}

Resume:
${resume}
          `,
        },
      ],
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;

    // Save resume to MongoDB with versioning
    const newResume = await Resume.create({
      userId: req.user.userId,
      jobDescription,
      content: aiResponse,
      type: 'Resume',
      createdAt: new Date(),
    });

    // Return AI resume
    res.json({ result: aiResponse });

  } catch (err) {
    console.error('Error generating resume:', err);
    res.status(500).json({ error: err.message || 'AI generation failed' });
  }
});

// ----------------------
// Get all user resumes (optional)
// ----------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ resumes });
  } catch (err) {
    console.error('Error fetching resumes:', err);
    res.status(500).json({ error: 'Could not fetch resumes' });
  }
});

module.exports = router;