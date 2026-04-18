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
    // Articles, conjunctions, prepositions
    'and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'our', 'will', 'into',
    'their', 'have', 'has', 'had', 'can', 'not', 'but', 'all', 'any', 'its', 'such', 'also', 'per',
    'who', 'what', 'they', 'them', 'well', 'use', 'using', 'used', 'new', 'get', 'set', 'due',
    'each', 'both', 'few', 'more', 'most', 'other', 'some', 'than', 'then', 'when', 'where', 'while',
    // Job posting filler words
    'job', 'role', 'work', 'team', 'years', 'year', 'experience', 'required', 'preferred', 'ability',
    'skills', 'skill', 'strong', 'seeking', 'looking', 'must', 'should', 'may', 'key', 'top',
    'description', 'responsibilities', 'requirements', 'qualifications', 'position', 'candidate',
    'applicant', 'company', 'organization', 'primary', 'secondary', 'following', 'including', 'include',
    'provide', 'ensure', 'support', 'across', 'within', 'about', 'above', 'below', 'between',
    'through', 'during', 'before', 'after', 'under', 'over', 'while', 'along', 'upon',
    'basis', 'level', 'type', 'area', 'areas', 'field', 'fields', 'based', 'related', 'relevant',
    'various', 'multiple', 'overall', 'daily', 'ongoing', 'current', 'general', 'specific',
    'minimum', 'maximum', 'highly', 'great', 'good', 'best', 'high', 'large', 'small',
    // Too generic to be meaningful resume keywords
    'project', 'manager', 'member', 'member', 'team', 'teams', 'people', 'person', 'group',
    'overseeing', 'oversee', 'manage', 'managing', 'working', 'making', 'taking', 'doing',
    'report', 'reports', 'reporting', 'meeting', 'meetings', 'tasks', 'task', 'activities'
  ]);

  const jobWords = tokenize(jobDescription).filter((word) => word.length >= 5 && !stopWords.has(word));
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
  return /(pmp|pcp|cisn|cissp|gcp|aws|azure|certified|certificate|certification|credential|accredited|license|exam|passed|obtained|earned|awarded|in progress)\b/i.test(String(text || ''));
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

function rewriteBullet(original, index, missingKeywords = []) {
  let cleaned = normalizeLineForRewrite(original);
  cleaned = cleaned.replace(/\.$/, '').trim();

  if (!cleaned || cleaned.length < 10) return null;
  if (isCertificationLikeLine(original)) return null;

  const hasAnyActionVerb = /^(led|managed|improved|delivered|built|launched|designed|developed|implemented|optimized|created|drove|owned|analyzed|provided|assessed|supported|maintained|ensured|established|executed|coordinated|oversaw|directed|supervised|drove|architected|engineered|planned|evaluated|reviewed|monitored|facilitated|collaborated|guided|analyze|provide|assess|support|maintain|ensure|establish|execute|manage|coordinate|oversee|direct|supervise|drive|plan|evaluate|review|monitor|facilitate|collaborate|guide)\b/i.test(cleaned);
  const hasMetric = /\d+/.test(cleaned);

  // Pick the best keyword for this specific bullet — cycle through so each gets a different one
  // Prefer concrete domain skills over generic nouns
  const genericNouns = new Set(['expertise', 'management', 'allocation', 'resource', 'timelines', 'initiative', 'initiatives']);
  const keyword = (missingKeywords || []).find(
    (kw, i) => {
      if (kw.length < 5) return false;
      if (cleaned.toLowerCase().includes(kw.toLowerCase())) return false;
      if (genericNouns.has(kw.toLowerCase())) return false;
      // Cycle: each bullet index skips the first `index` valid keywords
      return (missingKeywords.filter((k, j) => {
        if (k.length < 5) return false;
        if (cleaned.toLowerCase().includes(k.toLowerCase())) return false;
        if (genericNouns.has(k.toLowerCase())) return false;
        return j < missingKeywords.indexOf(kw);
      }).length === index % Math.max(1, missingKeywords.length));
    }
  ) || (missingKeywords || []).find(
    (kw) => kw.length >= 5 && !cleaned.toLowerCase().includes(kw.toLowerCase()) && !genericNouns.has(kw.toLowerCase())
  ) || null;

  // Helper: build phrase weaving keyword naturally
  const withKeyword = (base) => {
    if (!keyword) return `${base}, achieving measurable results (e.g., XX% improvement or $X saved).`;
    return `${base}, leveraging ${keyword} to achieve measurable results (e.g., XX% improvement or $X saved).`;
  };

  // Already has verb + metric — strong bullet, only suggest keyword if available
  if (hasAnyActionVerb && hasMetric) {
    if (keyword) {
      return `${capitalizeFirst(cleaned)}, with a focus on ${keyword} to drive further impact.`;
    }
    return null; // No improvement needed
  }

  // Has action verb but no metric — keep verb, add metric + keyword naturally
  if (hasAnyActionVerb) {
    return withKeyword(capitalizeFirst(cleaned));
  }

  // Weak bullet — rewrite with a strong action verb + keyword
  const starters = ['Led', 'Managed', 'Delivered', 'Executed', 'Spearheaded'];
  const starter = starters[index % starters.length];
  const lower = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  return withKeyword(`${starter} ${lower}`);
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
  const rewrittenBullets = weakBullets
    .map((b, index) => {
      const improved = rewriteBullet(b.text, index, missingKeywords);
      if (!improved) return null;
      return { original: b.text, improved };
    })
    .filter(Boolean);
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
