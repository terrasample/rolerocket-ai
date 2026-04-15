function extractBullets(resume) {
  return resume.split('\n').filter(l => l.trim().startsWith('-'));
}

function scoreBullet(b) {
  let score = 0;

  if (/\d+/.test(b)) score += 30;
  if (/led|managed|improved|delivered/i.test(b)) score += 30;
  if (b.length > 80) score += 20;
  if (/responsible|helped/i.test(b)) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function getRedFlags(resume) {
  const flags = [];

  if (!resume.includes('Experience')) flags.push('Missing Experience section');
  if (!resume.includes('Skills')) flags.push('Missing Skills section');
  if (resume.length < 300) flags.push('Resume too short');

  return flags;
}

function runATSAnalysis(job, resume) {
  const bullets = extractBullets(resume);

  const bulletScores = bullets.map(b => ({
    text: b,
    score: scoreBullet(b)
  }));

  const avg = bulletScores.length
    ? bulletScores.reduce((a,b)=>a+b.score,0)/bulletScores.length
    : 0;

  const flags = getRedFlags(resume);

  return {
    atsScore: Math.round(avg),
    bulletScores,
    redFlags: flags,
    matchedKeywords: [],
    missingKeywords: []
  };
}

module.exports = { runATSAnalysis };
