const express = require('express');
const planAccess = require('../middleware/planAccess');
const router = express.Router();

// PRO Features
router.post('/ats-optimizer', planAccess('ats-optimizer'), (req, res) => {
  // TODO: Implement ATS optimization logic
  res.json({ result: 'ATS Optimizer result (stub)' });
});
router.post('/job-market-radar', planAccess('job-market-radar'), (req, res) => {
  res.json({ result: 'Job Market Radar result (stub)' });
});
router.post('/application-quality-score', planAccess('application-quality-score'), (req, res) => {
  res.json({ result: 'Application Quality Score result (stub)' });
});
router.post('/resume-optimizer', planAccess('resume-optimizer'), (req, res) => {
  res.json({ result: 'Resume Optimizer result (stub)' });
});
router.post('/gamification', planAccess('gamification'), (req, res) => {
  res.json({ result: 'Gamification result (stub)' });
});

// PREMIUM Features
router.post('/interview-prep', planAccess('interview-prep'), (req, res) => {
  res.json({ result: 'Interview Prep result (stub)' });
});
router.post('/one-click-apply', planAccess('one-click-apply'), (req, res) => {
  res.json({ result: '1-Click Apply result (stub)' });
});
router.post('/ai-portfolio-builder', planAccess('ai-portfolio-builder'), (req, res) => {
  res.json({ result: 'AI Portfolio Builder result (stub)' });
});
router.post('/networking-ai', planAccess('networking-ai'), (req, res) => {
  const isAdmin = req.user && (req.user.isAdmin || String(req.user.plan) === 'lifetime');
  if (isAdmin) {
    return res.json({
      report: `Networking AI Demo\n\nSuggested connections: Jane Doe (Tech Lead), John Smith (HR), and Alex Lee (Mentor).\n\n- RoleRocket AI Demo` });
  }
  res.json({ result: 'Networking AI result (stub)' });
});
router.post('/ai-reference-generator', planAccess('ai-reference-generator'), (req, res) => {
  // If Admin, return a realistic demo report
  const isAdmin = req.user && (req.user.isAdmin || String(req.user.plan) === 'lifetime');
  if (isAdmin) {
    return res.json({
      report: `Reference Letter for Admin User\n\nTo Whom It May Concern,\n\nI am pleased to recommend [Admin User] for their outstanding leadership, technical expertise, and commitment to excellence. Their contributions have been instrumental in driving our team's success.\n\nSincerely,\nRoleRocket AI Demo` });
  }
  res.json({ result: 'AI Reference Generator result (stub)' });
});

// ELITE Features
router.post('/career-coach', planAccess('career-coach'), (req, res) => {
  res.json({ result: 'Career Coach result (stub)' });
});
router.post('/career-path-simulator', planAccess('career-path-simulator'), (req, res) => {
  const isAdmin = req.user && (req.user.isAdmin || String(req.user.plan) === 'lifetime');
  if (isAdmin) {
    return res.json({
      report: `Career Path Simulator Demo\n\nBased on your experience, you could advance to Senior Product Manager or pivot to a Director of Operations role within 2 years.\n\n- RoleRocket AI Demo` });
  }
  res.json({ result: 'Career Path Simulator result (stub)' });
});
router.post('/offer-negotiation-coach', planAccess('offer-negotiation-coach'), (req, res) => {
  res.json({ result: 'Offer Negotiation Coach result (stub)' });
});
router.post('/video-interview-practice', planAccess('video-interview-practice'), (req, res) => {
  res.json({ result: 'Video Interview Practice result (stub)' });
});
router.post('/calendar-task-ai', planAccess('calendar-task-ai'), (req, res) => {
  res.json({ result: 'Calendar & Task AI result (stub)' });
});
router.post('/ai-application-tracker', planAccess('ai-application-tracker'), (req, res) => {
  const isAdmin = req.user && (req.user.isAdmin || String(req.user.plan) === 'lifetime');
  if (isAdmin) {
    return res.json({
      report: `AI Application Tracker Demo\n\nYou have 5 active applications, 2 interviews scheduled, and 1 offer pending.\n\nKeep up the great work!\n\n- RoleRocket AI Demo` });
  }
  res.json({ result: 'AI Application Tracker result (stub)' });
});
router.post('/ai-job-agent', planAccess('ai-job-agent'), (req, res) => {
  res.json({ result: 'AI Job Agent result (stub)' });
});

module.exports = router;
