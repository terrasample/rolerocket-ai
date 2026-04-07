
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth'); // JWT middleware
const Resume = require('../models/Resume'); // MongoDB model
const OpenAI = require('openai');
const multer = require('multer');
const { extractTextFromPDF, extractTextFromDocx } = require('../pdfWordUtils');
const { extractTextFromPDFWithOCR } = require('../ocrUtils');

// Configure multer for memory storage (must be before any route uses 'upload')
const storage = multer.memoryStorage();
const upload = multer({ storage });

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