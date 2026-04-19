function extractBullets(resume) {
  const lines = String(resume || '').split('\n').map((line) => line.trim());
  const bullets = [];
  let current = null;

  const breaker = /^[A-Z][A-Z\s,&]{3,}$|^(EXPERIENCE|EDUCATION|SKILLS|CERTIFICATION|CERTIFICATIONS|SUMMARY|PROFILE|PROJECTS|AWARDS|CORE SKILLS)\b/i;
  const jobLine = /,\s*(FL|PA|NY|TX|CA|OH|GA|VA|DC|MD|NC|SC|IL|WA|MA|NJ|AZ|CO|MN|OR|TN|IN|MI)\b|,\s*(LLC|Inc|Corp|Company|University|College|Reserve|Army|Navy|Air Force)\b|\d{2}\/\d{4}/i;

  for (const line of lines) {
    if (/^[-*•]/.test(line)) {
      if (current) bullets.push(current);
      current = line.replace(/^[-*•]\s*/, '').trim();
    } else if (current && line.length > 0 && !breaker.test(line) && !jobLine.test(line)) {
      current = `${current} ${line}`;
    } else {
      if (current) bullets.push(current);
      current = null;
    }
  }

  if (current) bullets.push(current);
  return bullets;
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

  if (contentLines.length) return contentLines.slice(0, 14);
  return lines.slice(0, 14);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'our', 'will', 'into',
  'their', 'have', 'has', 'had', 'can', 'not', 'but', 'all', 'any', 'its', 'such', 'also', 'per',
  'which', 'might', 'could', 'would',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'desired', 'characteristics', 'meet', 'scheduled', 'completion', 'dates',
  'independently', 'prioritize', 'priorities', 'mutual', 'goals', 'expectations',
  'must', 'need', 'needs', 'able', 'willing', 'valid', 'driver', 'regularly', 'overnight',
  'drive', 'impact', 'resolve',
  'who', 'what', 'they', 'them', 'well', 'use', 'using', 'used', 'new', 'get', 'set', 'due',
  'each', 'both', 'few', 'more', 'most', 'other', 'some', 'than', 'then', 'when', 'where', 'while',
  'job', 'role', 'work', 'team', 'years', 'year', 'experience', 'required', 'preferred', 'ability',
  'skills', 'skill', 'strong', 'seeking', 'looking', 'must', 'should', 'may', 'key', 'top',
  'description', 'responsibilities', 'requirements', 'qualifications', 'position', 'candidate',
  'applicant', 'company', 'organization', 'primary', 'secondary', 'following', 'including', 'include',
  'provide', 'ensure', 'support', 'across', 'within', 'about', 'above', 'below', 'between',
  'through', 'during', 'before', 'after', 'under', 'over', 'along', 'upon',
  'basis', 'level', 'type', 'area', 'areas', 'field', 'fields', 'based', 'related', 'relevant',
  'various', 'multiple', 'overall', 'daily', 'ongoing', 'current', 'general', 'specific',
  'minimum', 'maximum', 'highly', 'great', 'good', 'best', 'high', 'large', 'small',
  'project', 'manager', 'member', 'teams', 'people', 'person', 'group', 'overseeing', 'oversee',
  'manage', 'managing', 'working', 'making', 'taking', 'doing', 'report', 'reports', 'reporting',
  'meeting', 'meetings', 'tasks', 'task', 'activities'
]);

const LOW_SIGNAL_PHRASES = [
  /^desired characteristics$/,
  /^meet scheduled$/,
  /^scheduled completion$/,
  /^completion dates$/,
  /^leading cross$/,
  /^which might$/
];

function isLowSignalTerm(term) {
  const normalized = normalizeText(term);
  if (!normalized) return true;

  if (LOW_SIGNAL_PHRASES.some((re) => re.test(normalized))) {
    return true;
  }

  // Filter short generic fragments that often come from sentence scaffolding.
  if (normalized.split(' ').length <= 2) {
    if (/^(scheduled|completion|dates|desired|characteristics)$/.test(normalized)) {
      return true;
    }
  }

  return false;
}

function uniqueOrdered(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function parseResumeSections(resume) {
  const lines = String(resume || '').split('\n').map((line) => line.trim());
  const map = {
    experience: '',
    skills: '',
    education: '',
    summary: '',
    certifications: '',
    other: ''
  };

  let section = 'other';

  for (const line of lines) {
    if (!line) continue;

    if (/^(experience|work experience|professional experience)\b/i.test(line)) {
      section = 'experience';
      continue;
    }
    if (/^(skills|technical skills|core competencies|tools|technologies)\b/i.test(line)) {
      section = 'skills';
      continue;
    }
    if (/^(education)\b/i.test(line)) {
      section = 'education';
      continue;
    }
    if (/^(summary|profile|objective)\b/i.test(line)) {
      section = 'summary';
      continue;
    }
    if (/^(certification|certifications|licenses|license)\b/i.test(line)) {
      section = 'certifications';
      continue;
    }

    map[section] = `${map[section]} ${line}`.trim();
  }

  return map;
}

function getKeywordsBasic(jobDescription, resume) {
  const jobWords = tokenize(jobDescription).filter((word) => word.length >= 5 && !STOP_WORDS.has(word));
  const uniqueJobWords = uniqueOrdered(jobWords);
  const resumeWords = new Set(tokenize(resume));

  const matchedKeywords = uniqueJobWords.filter((word) => resumeWords.has(word)).slice(0, 25);
  const missingKeywords = uniqueJobWords.filter((word) => !resumeWords.has(word)).slice(0, 25);

  return {
    matchedKeywords,
    missingKeywords,
    coverage: (matchedKeywords.length + missingKeywords.length)
      ? matchedKeywords.length / (matchedKeywords.length + missingKeywords.length)
      : 0,
    mustHaveMatched: [],
    mustHaveMissing: []
  };
}

function extractNGrams(tokens, size) {
  const out = [];
  for (let i = 0; i <= tokens.length - size; i += 1) {
    const chunk = tokens.slice(i, i + size);
    if (chunk.some((t) => STOP_WORDS.has(t))) continue;
    if (chunk.some((t) => t.length < 4)) continue;
    const phrase = chunk.join(' ');
    if (isLowSignalTerm(phrase)) continue;
    out.push(phrase);
  }
  return out;
}

function extractNGramsFromText(text, size) {
  const segments = String(text || '')
    .split(/[\n,.;:]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  for (const segment of segments) {
    const tokens = tokenize(segment);
    out.push(...extractNGrams(tokens, size));
  }
  return out;
}

function extractMustHaveTerms(jobDescription) {
  const mustSignals = /(must|required|mandatory|minimum|need to|license|certification|degree|bachelor|master|clearance|pmp|pe)\b/i;
  const segments = String(jobDescription || '')
    .split(/[\n.;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const terms = [];
  const pushIf = (value) => {
    const normalized = normalizeText(value);
    if (normalized) terms.push(normalized);
  };

  for (const segment of segments) {
    if (!mustSignals.test(segment)) continue;

    const normalizedSegment = normalizeText(segment);
    if (/\bbachelors?\s+degree\b/.test(normalizedSegment)) pushIf('bachelors degree');
    if (/\bassociate\s+degree\b/.test(normalizedSegment)) pushIf('associate degree');
    if (/\bproject\s+management\s+experience\b/.test(normalizedSegment)) pushIf('project management experience');
    if (/\bleading\s+cross\s+functional\s+teams\b/.test(normalizedSegment)) pushIf('leading cross functional teams');

    if (/\bvalid\s+drivers?\s+license\b/.test(normalizedSegment)) {
      pushIf('valid drivers license');
      pushIf('drivers license');
    } else if (/\bdrivers?\s+license\b/.test(normalizedSegment)) {
      pushIf('drivers license');
    }

    const travelRequirement = normalizedSegment.match(/\b(willing\s+and\s+able\s+to\s+travel(?:\s+regularly)?(?:\s+including\s+overnight)?)/);
    if (travelRequirement && travelRequirement[1]) {
      pushIf(travelRequirement[1]);
    } else if (/\btravel\b/.test(normalizedSegment)) {
      if (/\bovernight\b/.test(normalizedSegment)) {
        pushIf('travel including overnight');
      }
      if (/\bregularly\b/.test(normalizedSegment)) {
        pushIf('travel regularly');
      }
      pushIf('travel');
    }

    if (/\bpmp\b/.test(normalizedSegment)) pushIf('pmp certification');
    if (/\bsix\s+sigma\b/.test(normalizedSegment)) pushIf('six sigma certification');

    const cleaned = segment
      .replace(/\b(must|required|mandatory|minimum|need to|need|needs to)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = cleaned.split(/,|;|\//i).map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      const partTokens = tokenize(part).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
      if (!partTokens.length) continue;

      const phrase = partTokens.slice(0, 4).join(' ');
      if (phrase.length >= 5) terms.push(phrase);

      for (const token of partTokens) {
        if (token.length >= 6) terms.push(token);
      }
    }
  }

  const singleWordAllowlist = new Set(['clearance', 'pmp', 'cissp']);

  const filtered = uniqueOrdered(terms).filter((term) => {
    if (isLowSignalTerm(term)) return false;
    if (/\blicense\s+travel\b/i.test(term)) return false;
    if (/\bdrivers?\s+license\s+travel\b/i.test(term)) return false;
    if (/\bwhich\s+might\b/i.test(term)) return false;
    if (/\bdegree\s+management\b/i.test(term)) return false;
    if (/\bassociate\s+degree\s+five\b/i.test(term)) return false;
    if (/\bleading\s+cross\s+functional$/i.test(term)) return false;
    if (term.includes(' ')) return term.length >= 8;
    return singleWordAllowlist.has(term);
  });

  const sorted = [...filtered].sort((a, b) => b.length - a.length);
  const compacted = [];
  for (const term of sorted) {
    const alreadyCovered = compacted.some((kept) => kept.includes(term) && kept !== term);
    if (!alreadyCovered) compacted.push(term);
  }

  return compacted.sort((a, b) => a.localeCompare(b)).slice(0, 15);
}

function termMatchInText(term, text) {
  const normalizedTerm = normalizeText(term);
  const normalizedText = normalizeText(text);

  if (!normalizedTerm || !normalizedText) return false;
  if (normalizedTerm.includes(' ')) {
    return normalizedText.includes(normalizedTerm);
  }

  const re = new RegExp(`\\b${escapeRegex(normalizedTerm)}\\b`, 'i');
  return re.test(normalizedText);
}

function buildTrueLikeTerms(jobDescription) {
  const jobTokens = tokenize(jobDescription);
  const keywords = uniqueOrdered(jobTokens.filter((w) => w.length >= 5 && !STOP_WORDS.has(w))).slice(0, 35);
  const bigrams = uniqueOrdered(extractNGramsFromText(jobDescription, 2).filter((term) => !isLowSignalTerm(term))).slice(0, 20);
  const trigrams = uniqueOrdered(extractNGramsFromText(jobDescription, 3).filter((term) => !isLowSignalTerm(term))).slice(0, 12);
  const mustHave = extractMustHaveTerms(jobDescription);

  const weightedTerms = [];

  // Always include explicit must-have phrases/terms so full requirement clauses are evaluated.
  for (const term of mustHave) weightedTerms.push({ term, type: 'must-have', mustHave: true });

  for (const term of bigrams) weightedTerms.push({ term, type: 'phrase', mustHave: mustHave.includes(term) });
  for (const term of trigrams) weightedTerms.push({ term, type: 'phrase', mustHave: mustHave.includes(term) });
  for (const term of keywords) weightedTerms.push({ term, type: 'keyword', mustHave: mustHave.includes(term) });

  const deduped = [];
  const seen = new Set();
  for (const item of weightedTerms) {
    if (seen.has(item.term)) continue;
    seen.add(item.term);
    deduped.push(item);
  }

  return {
    terms: deduped.slice(0, 45),
    mustHave
  };
}

function getKeywordsTrueLike(jobDescription, resume) {
  const { terms, mustHave } = buildTrueLikeTerms(jobDescription);
  const sections = parseResumeSections(resume);

  const sectionWeight = {
    experience: 1.0,
    certifications: 0.95,
    skills: 0.85,
    summary: 0.75,
    education: 0.55,
    other: 0.65
  };

  let totalWeight = 0;
  let matchedWeight = 0;

  const matchedKeywords = [];
  const missingKeywords = [];
  const mustHaveMatched = [];
  const mustHaveMissing = [];

  for (const item of terms) {
    const typeMultiplier = item.type === 'phrase' ? 1.25 : 1;
    const mustHaveMultiplier = item.mustHave ? 1.8 : 1;
    const importance = typeMultiplier * mustHaveMultiplier;

    totalWeight += importance;

    let bestSectionScore = 0;
    let matched = false;

    for (const [sectionName, sectionText] of Object.entries(sections)) {
      if (!sectionText) continue;
      if (!termMatchInText(item.term, sectionText)) continue;

      matched = true;
      const score = sectionWeight[sectionName] || 0.6;
      if (score > bestSectionScore) bestSectionScore = score;
    }

    if (matched) {
      matchedWeight += importance * bestSectionScore;
      matchedKeywords.push(item.mustHave ? `${item.term} (must-have)` : item.term);
      if (item.mustHave) mustHaveMatched.push(item.term);
    } else {
      missingKeywords.push(item.mustHave ? `${item.term} (must-have)` : item.term);
      if (item.mustHave) mustHaveMissing.push(item.term);
    }
  }

  const prioritizedMissing = [
    ...missingKeywords.filter((k) => k.includes('(must-have)')),
    ...missingKeywords.filter((k) => !k.includes('(must-have)'))
  ];

  const cleanedMissing = uniqueOrdered(prioritizedMissing).filter((term) => {
    const raw = String(term || '').replace(/\s*\(must-have\)$/i, '').trim();
    if (isLowSignalTerm(raw)) return false;

    const isMustHave = /\(must-have\)$/i.test(term);
    const tokens = raw.split(/\s+/).filter(Boolean);
    const singleWordAllowlist = new Set(['autocad', 'smartsheet', 'magicplan', 'pmp', 'sigma', 'healthcare', 'installation']);
    if (!isMustHave && tokens.length === 1 && !singleWordAllowlist.has(tokens[0])) {
      return false;
    }

    return true;
  });

  const cleanedMatched = uniqueOrdered(matchedKeywords).filter((term) => {
    const raw = String(term || '').replace(/\s*\(must-have\)$/i, '').trim();
    if (isLowSignalTerm(raw)) return false;

    const isMustHave = /\(must-have\)$/i.test(term);
    const tokens = raw.split(/\s+/).filter(Boolean);
    const singleWordAllowlist = new Set(['autocad', 'smartsheet', 'magicplan', 'pmp', 'sigma', 'healthcare', 'installation']);
    if (!isMustHave && tokens.length === 1 && !singleWordAllowlist.has(tokens[0])) {
      return false;
    }

    return true;
  });

  // Remove partial phrase fragments when a more specific phrase exists.
  function compactBySpecificity(items) {
    const sorted = [...items].sort((a, b) => {
      const aMust = /\(must-have\)$/i.test(a) ? 1 : 0;
      const bMust = /\(must-have\)$/i.test(b) ? 1 : 0;
      if (aMust !== bMust) return bMust - aMust;
      return b.length - a.length;
    });

    const kept = [];
    for (const item of sorted) {
      const raw = String(item || '').replace(/\s*\(must-have\)$/i, '').trim();
      const covered = kept.some((k) => {
        const kRaw = String(k || '').replace(/\s*\(must-have\)$/i, '').trim();
        return kRaw !== raw && kRaw.includes(raw);
      });
      if (!covered) kept.push(item);
    }
    return kept;
  }

  const compactedMissing = compactBySpecificity(cleanedMissing);
  const compactedMatched = compactBySpecificity(cleanedMatched);

  return {
    matchedKeywords: compactedMatched.slice(0, 25),
    missingKeywords: compactedMissing.slice(0, 25),
    coverage: totalWeight ? matchedWeight / totalWeight : 0,
    mustHaveMatched: uniqueOrdered(mustHaveMatched),
    mustHaveMissing: uniqueOrdered(mustHaveMissing),
    mustHaveTotal: uniqueOrdered(mustHave).length
  };
}

function scoreBullet(b) {
  let score = 0;

  if (/\d+/.test(b)) score += 30;
  if (/led|managed|improved|delivered|analyzed|executed|owned|drove|planned|coordinated/i.test(b)) score += 30;
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
    .replace(/[\s,;:]+$/, '')
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

function sanitizeRewriteKeywords(missingKeywords) {
  return (missingKeywords || [])
    .map((k) => String(k || '').replace(/\s*\(must-have\)$/i, '').trim())
    .filter((k) => k.length >= 5)
    .slice(0, 20);
}

function rewriteBullet(original, index, missingKeywords = []) {
  let cleaned = normalizeLineForRewrite(original);
  cleaned = cleaned.replace(/\.$/, '').trim();

  if (!cleaned || cleaned.length < 10) return null;
  if (isCertificationLikeLine(original)) return null;

  const hasAnyActionVerb = /^(led|managed|improved|delivered|built|launched|designed|developed|implemented|optimized|created|drove|owned|analyzed|provided|assessed|supported|maintained|ensured|established|executed|coordinated|oversaw|directed|supervised|architected|engineered|planned|evaluated|reviewed|monitored|facilitated|collaborated|guided|analyze|provide|assess|support|maintain|ensure|establish|execute|manage|coordinate|oversee|direct|supervise|drive|plan|evaluate|review|monitor|facilitate|collaborate|guide)\b/i.test(cleaned);
  const hasMetric = /\d+/.test(cleaned);

  const candidates = sanitizeRewriteKeywords(missingKeywords);
  const keyword = candidates.length ? candidates[index % candidates.length] : null;

  const connectors = [
    (kw) => `translating ${kw} requirements into execution`,
    (kw) => `aligning delivery plans with ${kw} expectations`,
    (kw) => `embedding ${kw} into day-to-day operations`,
    (kw) => `strengthening ${kw} consistency across teams`,
    (kw) => `expanding impact by focusing on ${kw}`,
    (kw) => `applying ${kw} to improve delivery quality`
  ];
  const connector = connectors[index % connectors.length];

  const outcomeTails = [
    'improving consistency, speed, and stakeholder confidence.',
    'raising delivery quality while reducing execution risk.',
    'increasing on-time performance and operational reliability.',
    'improving cross-team alignment and measurable business outcomes.',
    'creating clearer ownership and faster issue resolution.'
  ];
  const tail = outcomeTails[index % outcomeTails.length];

  const withKeyword = (base) => {
    if (!keyword) return `${base}, ${tail}`;
    return `${base}, ${connector(keyword)}, ${tail}`;
  };

  if (hasAnyActionVerb && hasMetric) {
    if (keyword) {
      const strongConnectors = [
        `amplifying results through ${keyword}`,
        `reinforcing ${keyword} standards across delivery`,
        `driving stronger outcomes with ${keyword}`,
        `extending value by prioritizing ${keyword}`
      ];
      return `${capitalizeFirst(cleaned)}, ${strongConnectors[index % strongConnectors.length]}.`;
    }
    return `${capitalizeFirst(cleaned)}.`;
  }

  if (hasAnyActionVerb) {
    return withKeyword(capitalizeFirst(cleaned));
  }

  const starters = ['Led', 'Managed', 'Delivered', 'Executed', 'Spearheaded'];
  const starter = starters[index % starters.length];
  const lower = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  const firstWord = cleaned.split(' ')[0].toLowerCase();
  const alreadyStartsWithVerb = /^(identified|coordinated|communicated|leveraged|proactively|supported|analyzed|evaluated|monitored)$/i.test(firstWord);
  const base = alreadyStartsWithVerb ? capitalizeFirst(cleaned) : `${starter} ${lower}`;
  return withKeyword(base);
}

function rewriteBulletWithMultipleKeywords(original, index, missingKeywords = []) {
  const rewritten = rewriteBullet(original, index, missingKeywords);
  if (!rewritten || rewritten === original) return rewritten;

  const candidates = sanitizeRewriteKeywords(missingKeywords)
    .filter((kw) => !rewritten.toLowerCase().includes(kw.toLowerCase()))
    .slice(0, 2);

  if (!candidates.length) return rewritten;

  const lastPeriod = rewritten.lastIndexOf('.');
  if (lastPeriod <= 0) return rewritten;

  const beforePeriod = rewritten.substring(0, lastPeriod);
  const period = rewritten.substring(lastPeriod);
  const additionalKeywords = candidates.join(' and ');
  const addOns = [
    `while reinforcing ${additionalKeywords}`,
    `with added focus on ${additionalKeywords}`,
    `while deepening capability in ${additionalKeywords}`,
    `to further support ${additionalKeywords}`
  ];
  return `${beforePeriod}, ${addOns[index % addOns.length]}${period}`;
}

function getRedFlags(resume) {
  const flags = [];
  const normalizedResume = String(resume || '').toLowerCase();

  if (!normalizedResume.includes('experience')) flags.push('Missing Experience section');
  if (!normalizedResume.includes('skills')) flags.push('Missing Skills section');
  if (String(resume || '').length < 300) flags.push('Resume too short');

  return flags;
}

function getFormattingWarnings(resume, bullets) {
  const warnings = [];

  if (!/\S+@\S+\.\S+/.test(resume)) warnings.push('Missing a visible professional email in your resume header.');
  if (!bullets.length) warnings.push('Use bullet points for achievements to improve ATS readability.');
  if (String(resume || '').split('\n').some((line) => line.length > 180)) warnings.push('Some resume lines are too long; split long lines into shorter bullets.');

  return warnings;
}

function getQuickFixes({ missingKeywords, weakBullets, redFlags, formattingWarnings, mustHaveMissing }) {
  const fixes = [];

  if (mustHaveMissing && mustHaveMissing.length) {
    fixes.push(`Address must-have requirements first: ${mustHaveMissing.slice(0, 4).join(', ')}`);
  }
  if (missingKeywords.length) {
    fixes.push(`Add these missing terms where truthful: ${missingKeywords.slice(0, 5).join(', ')}`);
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

function getSectionAndFormattingHealth(redFlags, formattingWarnings, resume) {
  let sectionScore = 20;
  if (redFlags.includes('Missing Experience section')) sectionScore -= 10;
  if (redFlags.includes('Missing Skills section')) sectionScore -= 10;
  if (redFlags.includes('Resume too short')) sectionScore -= 8;

  let formattingScore = 15;
  formattingScore -= Math.min(12, formattingWarnings.length * 4);

  let depthScore = 10;
  if (String(resume || '').length > 1200) depthScore += 5;
  else if (String(resume || '').length < 500) depthScore -= 3;

  return { sectionScore, formattingScore, depthScore };
}

function calculateOverallScoreBasic({ coverage, bulletScores, redFlags, formattingWarnings, resume }) {
  const keywordScore = coverage * 45;
  const bulletAverage = bulletScores.length
    ? bulletScores.reduce((sum, item) => sum + item.score, 0) / bulletScores.length
    : 35;

  const { sectionScore, formattingScore, depthScore } = getSectionAndFormattingHealth(redFlags, formattingWarnings, resume);

  const total = keywordScore + (bulletAverage * 0.25) + sectionScore + formattingScore + depthScore;

  return {
    atsScore: clampScore(total),
    scoreBreakdown: {
      mode: 'basic',
      keywordCoveragePct: Math.round(coverage * 100),
      keywordScore: Math.round(keywordScore),
      bulletAverage: Math.round(bulletAverage),
      bulletScoreContribution: Math.round(bulletAverage * 0.25),
      sectionScore,
      formattingScore,
      depthScore
    }
  };
}

function calculateOverallScoreTrueLike({ coverage, mustHaveMatched, mustHaveMissing, bulletScores, redFlags, formattingWarnings, resume }) {
  const keywordScore = coverage * 55;

  const mustTotal = mustHaveMatched.length + mustHaveMissing.length;
  const mustHaveScore = mustTotal ? (mustHaveMatched.length / mustTotal) * 20 : 20;

  const bulletAverage = bulletScores.length
    ? bulletScores.reduce((sum, item) => sum + item.score, 0) / bulletScores.length
    : 35;

  let sectionHealth = 10;
  if (redFlags.includes('Missing Experience section')) sectionHealth -= 5;
  if (redFlags.includes('Missing Skills section')) sectionHealth -= 3;
  if (redFlags.includes('Resume too short')) sectionHealth -= 2;

  let formattingHealth = 15;
  formattingHealth -= Math.min(10, formattingWarnings.length * 2);

  let depthBonus = 0;
  if (String(resume || '').length > 1200) depthBonus += 2;

  const total = keywordScore + mustHaveScore + (bulletAverage * 0.15) + sectionHealth + formattingHealth + depthBonus;

  return {
    atsScore: clampScore(total),
    scoreBreakdown: {
      mode: 'true-like',
      weightedKeywordCoveragePct: Math.round(coverage * 100),
      weightedKeywordScore: Math.round(keywordScore),
      mustHaveMatched: mustHaveMatched.length,
      mustHaveMissing: mustHaveMissing.length,
      mustHaveScore: Math.round(mustHaveScore),
      bulletAverage: Math.round(bulletAverage),
      bulletScoreContribution: Math.round(bulletAverage * 0.15),
      sectionHealth,
      formattingHealth,
      depthBonus
    }
  };
}

function runATSAnalysis(job, resume, options = {}) {
  const mode = options.mode === 'basic' ? 'basic' : 'true-like';

  const bullets = extractBullets(resume);
  const scorableLines = bullets.length ? bullets : extractScorableLines(resume);

  const keywordData = mode === 'true-like'
    ? getKeywordsTrueLike(job, resume)
    : getKeywordsBasic(job, resume);

  const bulletScores = scorableLines.map((line) => ({
    text: line,
    score: scoreBullet(line)
  }));

  const redFlags = getRedFlags(resume);
  const formattingWarnings = getFormattingWarnings(resume, bullets);

  const weakBullets = bulletScores
    .filter((b) => b.score < 80 && isRewriteEligibleLine(b.text))
    .slice(0, 10);

  const rewrittenBullets = weakBullets
    .map((b, index) => {
      const improved = rewriteBulletWithMultipleKeywords(b.text, index, keywordData.missingKeywords);
      if (!improved || improved === b.text) return null;
      return { original: b.text, improved };
    })
    .filter(Boolean);

  const quickFixes = getQuickFixes({
    missingKeywords: keywordData.missingKeywords,
    weakBullets,
    redFlags,
    formattingWarnings,
    mustHaveMissing: keywordData.mustHaveMissing
  });

  const scoreResult = mode === 'true-like'
    ? calculateOverallScoreTrueLike({
        coverage: keywordData.coverage,
        mustHaveMatched: keywordData.mustHaveMatched,
        mustHaveMissing: keywordData.mustHaveMissing,
        bulletScores,
        redFlags,
        formattingWarnings,
        resume
      })
    : calculateOverallScoreBasic({
        coverage: keywordData.coverage,
        bulletScores,
        redFlags,
        formattingWarnings,
        resume
      });

  return {
    analysisMode: mode,
    atsScore: scoreResult.atsScore,
    scoreBreakdown: scoreResult.scoreBreakdown,
    bulletScores,
    redFlags,
    matchedKeywords: keywordData.matchedKeywords,
    missingKeywords: keywordData.missingKeywords,
    mustHaveMatched: keywordData.mustHaveMatched,
    mustHaveMissing: keywordData.mustHaveMissing,
    formattingWarnings,
    quickFixes,
    rewrittenBullets
  };
}

module.exports = { runATSAnalysis };
