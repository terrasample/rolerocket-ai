function extractBullets(resume) {
  return resume
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]/.test(line));
}

function extractScorableLines(resume) {
  const lines = String(resume || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sectionHeaders = /^(experience|skills|education|summary|profile|projects|certifications)$/i;
  const contactLine = /@|linkedin|github|portfolio|\+?\d[\d\s().-]{6,}/i;

  const contentLines = lines.filter((line) => {
    if (sectionHeaders.test(line)) return false;
    if (contactLine.test(line)) return false;
    return line.length >= 18;
  });

  if (contentLines.length) return contentLines.slice(0, 12);
  return lines.slice(0, 12);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function getKeywords(jobDescription, resume) {
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'our', 'will', 'into',
    'their', 'have', 'has', 'had', 'can', 'not', 'but', 'all', 'any', 'job', 'role', 'work', 'team',
    'years', 'year', 'experience', 'required', 'preferred', 'ability', 'skills', 'skill', 'strong'
  ]);

  const jobWords = tokenize(jobDescription).filter((word) => word.length >= 3 && !stopWords.has(word));
  const uniqueJobWords = Array.from(new Set(jobWords));
  const resumeWords = new Set(tokenize(resume));

  const matchedKeywords = uniqueJobWords.filter((word) => resumeWords.has(word)).slice(0, 25);
  const missingKeywords = uniqueJobWords.filter((word) => !resumeWords.has(word)).slice(0, 25);

  return { matchedKeywords, missingKeywords };
}

function scoreBullet(b) {
  let score = 0;

  if (/\d+/.test(b)) score += 30;
  if (/led|managed|improved|delivered/i.test(b)) score += 30;
  if (/built|created|launched|designed|developed|implemented|optimized|increased|reduced|streamlined/i.test(b)) score += 20;
  if (b.length > 80) score += 20;
  if (/responsible|helped/i.test(b)) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function capitalizeFirst(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeLineForRewrite(text) {
  return String(text || '')
    .replace(/^[-*•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCertificationLikeLine(text) {
  return /(pmp|pcp|cisn|cissp|gcp|aws|azure|certified|certification|credential|accredited|license|exam|passed|obtained|earned|awarded)\b/i.test(String(text || ''));
}

function isEducationLikeLine(text) {
  return /(bachelor|master|doctor|phd|mba|degree|university|college|expected\s+(fall|spring|summer|winter)|gpa|dean'?s list|coursework|graduat)/i.test(String(text || ''));
}

function isSkillsLikeLine(text) {
  const cleaned = normalizeLineForRewrite(text);
  const commaParts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
  const hasActionVerb = /\b(led|managed|improved|delivered|built|launched|designed|developed|implemented|optimized|created|drove|owned)\b/i.test(cleaned);

  if (hasActionVerb) return false;
  if (commaParts.length >= 3) return true;
  if (/^(skills|technical skills|core competencies|tools|technologies)\b/i.test(cleaned)) return true;

  return false;
}

function isRewriteEligibleLine(text) {
  const cleaned = normalizeLineForRewrite(text);
  if (!cleaned) return false;
  if (isEducationLikeLine(cleaned)) return false;
  if (isSkillsLikeLine(cleaned)) return false;
  if (isCertificationLikeLine(cleaned)) return false;
  if (cleaned.length < 24) return false;
  return true;
}

function rewriteBullet(original, index) {
  let cleaned = normalizeLineForRewrite(original);
  cleaned = cleaned.replace(/\.$/, ''); // Remove trailing period
  
  // Special handling for certifications: recommend additional certs or job duties instead
  if (isCertificationLikeLine(original)) {
    const suggestions = [
      `Consider pairing ${cleaned} with a complementary skill or responsibility.`,
      `${cleaned}, actively applying and maintaining this credential in daily work.`,
      `Holder of ${cleaned}; recommend documenting specific projects or achievements where this certification was applied.`
    ];
    return suggestions[index % suggestions.length];
  }
  
  // Broader action verb detection: includes past-tense and present-tense verbs
  const hasAnyActionVerb = /^(led|managed|improved|delivered|built|launched|designed|developed|implemented|optimized|created|drove|owned|analyze|analyzed|provide|provided|assess|assessed|support|supported|maintain|maintained|ensure|ensured|establish|established|execute|executed|manage|coordinate|oversee|direct|supervise|drive|architect|engineer)\b/i.test(cleaned);
  const hasMetric = /\d+/.test(cleaned);

  // If it already has strong action verb, just capitalize it
  if (hasAnyActionVerb) {
    const capitalized = capitalizeFirst(cleaned);
    if (hasMetric) {
      return capitalized;
    }
    return `${capitalized}, delivering measurable impact through XX% improvement, $X cost savings, or X additional projects.`;
  }

  // If no action verb, add one
  const starters = ['Led', 'Improved', 'Delivered', 'Built', 'Launched'];
  const starter = starters[index % starters.length];
  
  if (hasMetric) {
    return `${starter} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
  }

  return `${starter} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}, delivering a measurable outcome such as XX% faster execution or X more completed projects.`;
}

function getRedFlags(resume) {
  const flags = [];
  const normalizedResume = String(resume || '').toLowerCase();

  if (!normalizedResume.includes('experience')) flags.push('Missing Experience section');
  if (!normalizedResume.includes('skills')) flags.push('Missing Skills section');
  if (resume.length < 300) flags.push('Resume too short');

  return flags;
}

function getFormattingWarnings(resume, bullets) {
  const warnings = [];

  if (!/\S+@\S+\.\S+/.test(resume)) warnings.push('Missing a visible professional email in your resume header.');
  if (!bullets.length) warnings.push('Use bullet points for achievements to improve ATS readability.');
  if (resume.split('\n').some((line) => line.length > 180)) warnings.push('Some resume lines are too long; split long lines into shorter bullets.');

  return warnings;
}

function getQuickFixes({ missingKeywords, weakBullets, redFlags, formattingWarnings }) {
  const fixes = [];

  if (missingKeywords.length) {
    fixes.push(`Add these missing keywords where truthful: ${missingKeywords.slice(0, 5).join(', ')}`);
  }
  if (weakBullets.length) {
    fixes.push('Rewrite weak bullets with action verbs and measurable outcomes.');
  }
  if (redFlags.length) {
    fixes.push(`Address section gaps: ${redFlags.join('; ')}`);
  }
  if (formattingWarnings.length) {
    fixes.push('Use ATS-safe formatting with standard headings and simple spacing.');
  }

  return fixes;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateOverallScore({ matchedKeywords, missingKeywords, bulletScores, redFlags, formattingWarnings, resume }) {
  const keywordTotal = matchedKeywords.length + missingKeywords.length;
  const keywordScore = keywordTotal ? (matchedKeywords.length / keywordTotal) * 45 : 20;
  const bulletAverage = bulletScores.length
    ? bulletScores.reduce((sum, item) => sum + item.score, 0) / bulletScores.length
    : 35;

  let sectionScore = 20;
  if (redFlags.includes('Missing Experience section')) sectionScore -= 10;
  if (redFlags.includes('Missing Skills section')) sectionScore -= 10;
  if (redFlags.includes('Resume too short')) sectionScore -= 8;

  let formattingScore = 15;
  formattingScore -= Math.min(12, formattingWarnings.length * 4);

  let depthScore = 10;
  if (String(resume || '').length > 1200) depthScore += 5;
  else if (String(resume || '').length < 500) depthScore -= 3;

  return clampScore(keywordScore + (bulletAverage * 0.25) + sectionScore + formattingScore + depthScore);
}

function runATSAnalysis(job, resume) {
  const bullets = extractBullets(resume);
  const scorableLines = bullets.length ? bullets : extractScorableLines(resume);
  const { matchedKeywords, missingKeywords } = getKeywords(job, resume);

  const bulletScores = scorableLines.map((line) => ({
    text: line,
    score: scoreBullet(line)
  }));

  const flags = getRedFlags(resume);
  const formattingWarnings = getFormattingWarnings(resume, bullets);
  const weakBullets = bulletScores
    .filter((b) => b.score < 60 && isRewriteEligibleLine(b.text))
    .slice(0, 4);
  const rewrittenBullets = weakBullets.map((b, index) => ({
    original: b.text,
    improved: rewriteBullet(b.text, index)
  }));
  const quickFixes = getQuickFixes({
    missingKeywords,
    weakBullets,
    redFlags: flags,
    formattingWarnings
  });

  const atsScore = calculateOverallScore({
    matchedKeywords,
    missingKeywords,
    bulletScores,
    redFlags: flags,
    formattingWarnings,
    resume
  });

  return {
    atsScore,
    bulletScores,
    redFlags: flags,
    matchedKeywords,
    missingKeywords,
    formattingWarnings,
    quickFixes,
    rewrittenBullets
  };
}

module.exports = { runATSAnalysis };
