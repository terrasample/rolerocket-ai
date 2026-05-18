
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth'); // JWT middleware
const Resume = require('../models/Resume'); // MongoDB model
const User = require('../models/User');
const OpenAI = require('openai');
const multer = require('multer');
const { extractTextFromPDF, extractTextFromDocx } = require('../pdfWordUtils');
const { extractTextFromPDFWithOCR } = require('../ocrUtils');
const { consumeDocumentGeneration, getDocumentGenerationStatus } = require('../services/documentGenerationBilling');

// Configure multer for memory storage (must be before any route uses 'upload')
const storage = multer.memoryStorage();
const upload = multer({ storage });

function sanitizeTemplateState(input) {
  const queue = Array.isArray(input?.queue)
    ? input.queue.filter((n) => Number.isInteger(n) && n >= 0 && n <= 200).slice(0, 50)
    : [];
  const lastTemplateIdx = Number.isInteger(input?.lastTemplateIdx) ? input.lastTemplateIdx : -1;
  return { queue, lastTemplateIdx };
}

router.get('/template-state', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('resumeTemplateRotation');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const state = sanitizeTemplateState(user.resumeTemplateRotation || {});
    res.json({ state });
  } catch (err) {
    console.error('Error fetching resume template state:', err);
    res.status(500).json({ error: 'Could not fetch template state' });
  }
});

router.put('/template-state', authenticateToken, async (req, res) => {
  try {
    const state = sanitizeTemplateState(req.body || {});
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          resumeTemplateRotation: {
            ...state,
            updatedAt: new Date()
          }
        }
      },
      { new: true, projection: { resumeTemplateRotation: 1 } }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ state: sanitizeTemplateState(user.resumeTemplateRotation || {}) });
  } catch (err) {
    console.error('Error updating resume template state:', err);
    res.status(500).json({ error: 'Could not update template state' });
  }
});

// Save resume content (for dashboard) - supports file upload or pasted text
router.post('/save', authenticateToken, upload.single('resumeFile'), async (req, res) => {
  try {
    let content = req.body.content || '';
    let fileParsed = false;
    // If a file is uploaded, parse it
    if (req.file) {
      const mime = req.file.mimetype;
      function toArrayBuffer(buffer) {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      }
      if (mime === 'application/pdf') {
        content = await extractTextFromPDF(req.file.buffer);
        if (!content.trim()) {
          content = await extractTextFromPDFWithOCR(toArrayBuffer(req.file.buffer));
        }
        fileParsed = true;
      } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        content = await extractTextFromDocx(req.file.buffer);
        fileParsed = true;
      } else if (mime.startsWith('text/')) {
        content = req.file.buffer.toString('utf8');
        fileParsed = true;
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }
    }
    if (!content.trim()) {
      return res.status(400).json({ error: fileParsed ? 'Could not extract text from file.' : 'Resume content required' });
    }
    await Resume.create({ userId: req.user.userId, content, type: 'Resume', title: req.body.title || 'Dashboard Resume', createdAt: new Date() });
    res.json({ message: 'Resume saved!' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save resume' });
  }
});




// Initialize OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set in environment variables');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// Upload resume file (PDF/DOCX/TXT)
router.post('/upload', authenticateToken, upload.single('resumeFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  let text = '';
  const mime = req.file.mimetype;
  // Use Buffer for pdf-parse and mammoth, ArrayBuffer for pdfjs-dist (OCR)
  // Utility: Convert Node.js Buffer to ArrayBuffer for pdfjs-dist
  function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  try {
    if (mime === 'application/pdf') {
      // pdf-parse expects Buffer
      text = await extractTextFromPDF(req.file.buffer);
      if (!text.trim()) {
        // pdfjs-dist expects ArrayBuffer for OCR
        text = await extractTextFromPDFWithOCR(toArrayBuffer(req.file.buffer));
      }
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // mammoth expects Buffer
      text = await extractTextFromDocx(req.file.buffer);
    } else if (mime.startsWith('text/')) {
      text = req.file.buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }
    if (!text.trim()) {
      console.error('Resume upload error: Could not extract text from file. Mime:', mime, 'Size:', req.file.size);
      return res.status(400).json({ error: 'Could not extract text from file. Please ensure your file is a valid, text-based or image-based PDF, or DOCX.' });
    }
    await Resume.create({ userId: req.user.userId, content: text, type: 'Resume', createdAt: new Date() });
    res.json({ message: 'Resume uploaded and saved', content: text });
  } catch (err) {
    console.error('Resume upload error:', err);
    return res.status(500).json({ error: 'Failed to process resume file. ' + (err.message || '') });
  }
});

// ----------------------
// Generate AI Resume
// ----------------------

function normalizeResumeText(text) {
  if (!text) return '';
  
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Fix incomplete date ranges: "January 2023 - December" → "January 2023 - December 2023"
  text = text.replace(/(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\s*[-–]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\b(?!\s+\d{4})/gi, 
    (match, startDate, endMonth) => {
      const year = startDate.split(/\s+/).pop();
      return `${startDate} - ${endMonth} ${year}`;
    });
  
  // Consolidate multiple empty lines
  text = text.replace(/\n\n\n+/g, '\n\n');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

router.post('/generate', authenticateToken, async (req, res) => {
  const { jobDescription, resume } = req.body;

  // Validate input — resume is optional
  if (!jobDescription) {
    return res.status(400).json({ error: 'jobDescription is required' });
  }

  try {
    const user = await User.findById(req.user.userId).select('plan isAdmin documentGeneration');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const status = getDocumentGenerationStatus(user, 'resume');
    if (!status.canGenerate) {
      return res.status(402).json({
        error: 'No resume credits remaining. Buy a bundle to continue.',
        code: 'DOC_CREDIT_REQUIRED',
        status
      });
    }

    await consumeDocumentGeneration(user, 'resume');

    // Normalize resume text for better parsing
    const normalizedResume = resume ? normalizeResumeText(resume) : '';

    // Call OpenAI to generate improved resume
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1800,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `
You are an expert executive resume writer. Your goal is to produce perfectly polished, fact-based, impact-driven resumes that showcase the candidate's strongest qualifications.

${normalizedResume ? `Your task:
1) Rewrite the candidate's base resume so it is perfectly tailored to the target role.
2) Keep every claim strictly fact-based from the provided resume; do not invent, add, or assume any employers, job titles, dates, tools, certifications, or skills that are not explicitly stated in the resume.
3) Only list skills that appear in the resume OR are directly stated as requirements in the job description — never infer tools or credentials.
4) Remove placeholders, generic filler text, and redundancy.
5) Preserve the candidate's real full name exactly as it appears in the source resume.
6) Ensure all date ranges are complete and properly formatted (e.g., "January 2023 - December 2023", not "January 2023 - December").
7) Validate that experience entries have both start and end dates or "Present".
8) Elevate the writing to be compelling and polished while remaining factual.` : `Your task:
1) Create a professional resume TEMPLATE tailored to the target role using only the job description provided.
2) CRITICAL: Do NOT invent any real employers, company names, job titles held, dates, schools, certifications, or tools. Every experience and education entry must be a clearly labelled placeholder the user will fill in.
3) Only list skills that are explicitly stated in the job description.
4) Use placeholder contact details (e.g. "Your Name | your.email@example.com | City, State").`}

Output requirements:
- Return a complete, polished resume in plain text.
- Never use placeholder names such as "Candidate Name" or "Your Name" unless no resume was provided.
- Use this exact section order when available:
  NAME
  CONTACT (email | phone | city, state | LinkedIn/portfolio if provided)
  PROFILE (2-3 lines max, compelling and specific to the role)
  EXPERIENCE (each with complete date range: Month Year - Month Year or Month Year - Present)
  EDUCATION (degree, institution, graduation date)
  SKILLS (comma-separated, grouped by category if relevant)
  CERTIFICATIONS (if applicable)
  AWARDS (only if provided)
- EXPERIENCE section critical requirements:
  * Each entry MUST have: [Job Title], [Company Name], [City, State] | [Month Year – Month Year]
  * Use 3-5 achievement-focused bullets per role
  * Bullets must be specific, impactful, and quantified where possible
  * No generic or overused phrases ("Responsible for", "Worked on", "Helped", "Assisted")
  * Focus on business outcomes and measurable impact
  * Date ranges must be complete and consistent
- Remove duplicate contact information or embedded phone/email in job descriptions
- Ensure perfect spacing, formatting, and visual hierarchy
- Do not include markdown code fences or special formatting
- After the resume, append:
  IMPROVEMENTS:
  - 3 to 6 short bullets explaining what was improved${normalizedResume ? ' and any refinements made.' : ' or what the user should fill in.'}
          `,
        },
        {
          role: 'user',
          content: `
Job Description:
${jobDescription}

${normalizedResume ? `Provided Resume:\n${normalizedResume}` : 'No resume provided. Generate a resume template as instructed — use only placeholder entries for experience and education, and only include skills explicitly listed in the job description above.'}
          `,
        },
      ],
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
    if (err.code === 'DOC_CREDIT_REQUIRED') {
      return res.status(err.statusCode || 402).json({
        error: err.message,
        code: err.code,
        status: err.status || null
      });
    }
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