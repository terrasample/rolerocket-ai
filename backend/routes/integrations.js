const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/auth');
const User = require('../models/User');
const RoleProfile = require('../models/RoleProfile');
const Resume = require('../models/Resume');
const UserCredential = require('../models/UserCredential');
const CourseProgress = require('../models/CourseProgress');
const Application = require('../models/Application');
const Employer = require('../models/Employer');
const EmployerJob = require('../models/EmployerJob');
const DiasporaEmployer = require('../models/DiasporaEmployer');
const CommunityHub = require('../models/CommunityHub');
const PlacementOutcome = require('../models/PlacementOutcome');
const IntegrationAccess = require('../models/IntegrationAccess');
const IntegrationAuditLog = require('../models/IntegrationAuditLog');

const ADMIN_PLANS = new Set(['elite', 'lifetime']);
const INTEGRATION_ADMIN_EMAILS = String(process.env.INTEGRATION_ADMIN_EMAILS || '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);

function toCompletionScore(checks) {
  if (!Array.isArray(checks) || !checks.length) return 0;
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function normalizeLayerName(layer) {
  const key = String(layer || '').toLowerCase();
  if (!key || key === 'all') return 'all';
  if (key === 'school' || key === 'schools') return 'schools';
  if (key === 'university' || key === 'universities') return 'universities';
  if (key === 'government' || key === 'gov' || key === 'workforce') return 'government';
  if (key === 'employer' || key === 'employers') return 'employers';
  return key;
}

function normalizeAccessLayer(layer) {
  const key = normalizeLayerName(layer);
  if (key === 'schools' || key === 'universities' || key === 'government' || key === 'employers') return key;
  return null;
}

function sourceLayerFromAccessLayer(layer) {
  if (layer === 'schools') return 'school';
  if (layer === 'universities') return 'university';
  if (layer === 'government') return 'government-program';
  if (layer === 'employers') return 'employer';
  return 'self-service';
}

function accessLayerFromSourceLayer(sourceLayer) {
  const key = String(sourceLayer || '').trim();
  if (key === 'school') return 'schools';
  if (key === 'university') return 'universities';
  if (key === 'government-program') return 'government';
  if (key === 'employer') return 'employers';
  return null;
}

function isIntegrationAdminUser(user) {
  if (!user) return false;
  const plan = String(user.plan || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  if (ADMIN_PLANS.has(plan)) return true;
  if (INTEGRATION_ADMIN_EMAILS.length && INTEGRATION_ADMIN_EMAILS.includes(email)) return true;
  return false;
}

async function getAuthUser(req) {
  return User.findById(req.user.userId).lean();
}

async function hasInstitutionAccess(userId, layer, institutionName) {
  const institutionKey = String(institutionName || '').trim().toLowerCase();
  if (!institutionKey) return false;
  const row = await IntegrationAccess.findOne({ userId, layer, institutionKey }).lean();
  return !!row;
}

async function getInstitutionAccessRecord(userId, layer, institutionName) {
  const institutionKey = String(institutionName || '').trim().toLowerCase();
  if (!institutionKey) return null;
  return IntegrationAccess.findOne({ userId, layer, institutionKey }).lean();
}

function hasRequiredInstitutionRole(role, requiredRole) {
  const rank = { viewer: 1, analyst: 2, manager: 3, admin: 4 };
  return (rank[String(role || 'viewer')] || 0) >= (rank[String(requiredRole || 'viewer')] || 1);
}

async function assertInstitutionAccess({ req, actor, layer, institutionName, requiredRole = 'viewer' }) {
  if (isIntegrationAdminUser(actor)) return { ok: true, reason: 'integration-admin' };

  const access = await getInstitutionAccessRecord(req.user.userId, layer, institutionName);
  if (!access) return { ok: false, reason: 'no-access-record' };
  if (!hasRequiredInstitutionRole(access.role, requiredRole)) {
    return { ok: false, reason: `role-${access.role}-insufficient-for-${requiredRole}` };
  }
  return { ok: true, reason: `role-${access.role}` };
}

function asCsvRow(values) {
  return values.map((value) => {
    const raw = value == null ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(',');
}

async function logIntegrationAudit(req, actor, payload) {
  try {
    await IntegrationAuditLog.create({
      actorUserId: actor?._id || req.user?.userId || null,
      actorEmail: String(actor?.email || '').toLowerCase(),
      actorPlan: String(actor?.plan || '').toLowerCase(),
      action: String(payload?.action || 'unknown').trim(),
      targetType: String(payload?.targetType || '').trim(),
      targetId: String(payload?.targetId || '').trim(),
      layer: String(payload?.layer || '').trim(),
      institutionName: String(payload?.institutionName || '').trim(),
      details: payload?.details || {},
      ip: String(req.ip || req.headers['x-forwarded-for'] || ''),
      userAgent: String(req.headers['user-agent'] || '')
    });
  } catch (error) {
    console.error('Integration audit log write failed:', error);
  }
}

async function buildOverview() {
  const [
    users,
    roleProfiles,
    resumes,
    verifiedCredentials,
    courseProgress,
    applications,
    employers,
    activeEmployerJobs,
    totalDiasporaEmployers,
    approvedDiasporaEmployers,
    partnerCommunityHubs,
    placements,
    hiredPlacements,
    retainedPlacements
  ] = await Promise.all([
    User.countDocuments(),
    RoleProfile.countDocuments(),
    Resume.countDocuments(),
    UserCredential.countDocuments({ verificationStatus: 'verified' }),
    CourseProgress.countDocuments(),
    Application.countDocuments(),
    Employer.countDocuments(),
    EmployerJob.countDocuments({ active: true }),
    DiasporaEmployer.countDocuments({ isActive: true }),
    DiasporaEmployer.countDocuments({ isActive: true, verificationStatus: 'approved' }),
    CommunityHub.countDocuments({ partnersWithRoleRocket: true, isActive: true }),
    PlacementOutcome.countDocuments(),
    PlacementOutcome.countDocuments({ status: { $in: ['hired', 'retained-90'] } }),
    PlacementOutcome.countDocuments({ status: 'retained-90' })
  ]);

  const schoolsChecks = [
    roleProfiles > 0,
    resumes > 0,
    verifiedCredentials > 0,
    courseProgress > 0,
    partnerCommunityHubs > 0
  ];

  const universitiesChecks = [
    applications > 0,
    resumes > 0,
    verifiedCredentials > 0,
    hiredPlacements > 0,
    retainedPlacements > 0
  ];

  const governmentChecks = [
    approvedDiasporaEmployers > 0,
    activeEmployerJobs > 0,
    partnerCommunityHubs > 0,
    hiredPlacements > 0,
    applications > 0
  ];

  const employerChecks = [
    employers > 0,
    activeEmployerJobs > 0,
    totalDiasporaEmployers > 0,
    hiredPlacements > 0,
    retainedPlacements > 0
  ];

  return {
    generatedAt: new Date().toISOString(),
    layers: {
      studentsFacing: {
        completionScore: toCompletionScore([roleProfiles > 0, resumes > 0, applications > 0, courseProgress > 0, activeEmployerJobs > 0]),
        metrics: {
          users,
          roleProfiles,
          resumes,
          courseProgress,
          applications,
          activeEmployerJobs
        }
      },
      schools: {
        completionScore: toCompletionScore(schoolsChecks),
        metrics: {
          roleProfiles,
          resumes,
          verifiedCredentials,
          courseProgress,
          partnerCommunityHubs,
          placements
        }
      },
      universities: {
        completionScore: toCompletionScore(universitiesChecks),
        metrics: {
          resumes,
          applications,
          verifiedCredentials,
          hiredPlacements,
          retainedPlacements,
          activeEmployerJobs
        }
      },
      government: {
        completionScore: toCompletionScore(governmentChecks),
        metrics: {
          approvedDiasporaEmployers,
          totalDiasporaEmployers,
          activeEmployerJobs,
          partnerCommunityHubs,
          hiredPlacements,
          applications
        }
      },
      employers: {
        completionScore: toCompletionScore(employerChecks),
        metrics: {
          employers,
          activeEmployerJobs,
          totalDiasporaEmployers,
          approvedDiasporaEmployers,
          hiredPlacements,
          retainedPlacements
        }
      }
    }
  };
}

router.get('/overview', async (req, res) => {
  try {
    const layer = normalizeLayerName(req.query.layer);
    const overview = await buildOverview();

    if (layer !== 'all') {
      if (!overview.layers[layer]) {
        return res.status(400).json({ error: 'Unknown layer. Use schools, universities, government, employers, or all.' });
      }
      return res.json({ generatedAt: overview.generatedAt, layer, data: overview.layers[layer] });
    }

    return res.json(overview);
  } catch (err) {
    console.error('Integration overview error:', err);
    return res.status(500).json({ error: 'Failed to load integration overview' });
  }
});

router.get('/schools/overview', async (req, res) => {
  try {
    const overview = await buildOverview();
    return res.json({ generatedAt: overview.generatedAt, layer: 'schools', data: overview.layers.schools });
  } catch (err) {
    console.error('Schools overview error:', err);
    return res.status(500).json({ error: 'Failed to load schools overview' });
  }
});

router.get('/universities/overview', async (req, res) => {
  try {
    const overview = await buildOverview();
    return res.json({ generatedAt: overview.generatedAt, layer: 'universities', data: overview.layers.universities });
  } catch (err) {
    console.error('Universities overview error:', err);
    return res.status(500).json({ error: 'Failed to load universities overview' });
  }
});

router.get('/government/overview', async (req, res) => {
  try {
    const overview = await buildOverview();
    return res.json({ generatedAt: overview.generatedAt, layer: 'government', data: overview.layers.government });
  } catch (err) {
    console.error('Government overview error:', err);
    return res.status(500).json({ error: 'Failed to load government overview' });
  }
});

router.get('/employers/overview', async (req, res) => {
  try {
    const overview = await buildOverview();
    return res.json({ generatedAt: overview.generatedAt, layer: 'employers', data: overview.layers.employers });
  } catch (err) {
    console.error('Employers overview error:', err);
    return res.status(500).json({ error: 'Failed to load employers overview' });
  }
});

router.get('/placements/funnel', async (_req, res) => {
  try {
    const pipeline = await PlacementOutcome.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary = {
      applied: 0,
      screening: 0,
      interview: 0,
      offered: 0,
      hired: 0,
      'retained-90': 0
    };

    pipeline.forEach((item) => {
      if (summary[item._id] !== undefined) summary[item._id] = item.count;
    });

    return res.json({ summary, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Placement funnel error:', err);
    return res.status(500).json({ error: 'Failed to load placement funnel' });
  }
});

router.get('/access/my', authenticateToken, async (req, res) => {
  try {
    const rows = await IntegrationAccess.find({ userId: req.user.userId })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ access: rows });
  } catch (err) {
    console.error('My integration access error:', err);
    return res.status(500).json({ error: 'Failed to load access list' });
  }
});

router.post('/access/grant', authenticateToken, async (req, res) => {
  try {
    const actor = await getAuthUser(req);
    if (!isIntegrationAdminUser(actor)) {
      return res.status(403).json({ error: 'Admin access required to grant permissions' });
    }

    const { userId, userEmail, layer, institutionName, role } = req.body || {};
    const normalizedLayer = normalizeAccessLayer(layer);
    if (!normalizedLayer) {
      return res.status(400).json({ error: 'Invalid layer. Use schools, universities, government, or employers.' });
    }
    if (!String(institutionName || '').trim()) {
      return res.status(400).json({ error: 'institutionName is required' });
    }

    let targetUserId = userId || null;
    if (!targetUserId && userEmail) {
      const targetUser = await User.findOne({ email: String(userEmail).trim().toLowerCase() }).lean();
      if (!targetUser) return res.status(404).json({ error: 'Target user not found' });
      targetUserId = targetUser._id;
    }
    if (!targetUserId) return res.status(400).json({ error: 'Provide userId or userEmail' });

    const update = {
      userId: targetUserId,
      layer: normalizedLayer,
      institutionName: String(institutionName).trim(),
      institutionKey: String(institutionName).trim().toLowerCase(),
      role: ['viewer', 'analyst', 'manager', 'admin'].includes(String(role || '').toLowerCase()) ? String(role).toLowerCase() : 'viewer',
      grantedBy: req.user.userId
    };

    const saved = await IntegrationAccess.findOneAndUpdate(
      { userId: targetUserId, layer: normalizedLayer, institutionKey: update.institutionKey },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logIntegrationAudit(req, actor, {
      action: 'integration-access-granted',
      targetType: 'integration-access',
      targetId: String(saved?._id || ''),
      layer: normalizedLayer,
      institutionName: update.institutionName,
      details: {
        grantedToUserId: String(targetUserId),
        role: update.role,
        institutionKey: update.institutionKey
      }
    });

    return res.status(201).json({ success: true, access: saved });
  } catch (err) {
    console.error('Grant access error:', err);
    return res.status(500).json({ error: 'Failed to grant access' });
  }
});

router.get('/institutions/dashboard', authenticateToken, async (req, res) => {
  try {
    const layer = normalizeAccessLayer(req.query.layer);
    const institutionName = String(req.query.institution || '').trim();
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const countryFilter = String(req.query.country || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const sortByRaw = String(req.query.sortBy || 'createdAt').trim().toLowerCase();
    const sortDirRaw = String(req.query.sortDir || 'desc').trim().toLowerCase();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    if (!layer || !institutionName) {
      return res.status(400).json({ error: 'layer and institution query params are required' });
    }

    const actor = await getAuthUser(req);
    const access = await assertInstitutionAccess({ req, actor, layer, institutionName, requiredRole: 'viewer' });
    if (!access.ok) {
      return res.status(403).json({ error: 'No permission to view this institution dashboard' });
    }

    const baseMatch = {
      sourceLayer: sourceLayerFromAccessLayer(layer),
      institutionName
    };

    if (statusFilter) {
      const allowedStatuses = new Set(['applied', 'screening', 'interview', 'offered', 'hired', 'retained-90']);
      if (!allowedStatuses.has(statusFilter)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      baseMatch.status = statusFilter;
    }

    if (countryFilter) {
      baseMatch.country = new RegExp(`^${countryFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    const createdAtFilter = {};
    if (dateFrom) {
      const dt = new Date(dateFrom);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateFrom filter' });
      createdAtFilter.$gte = dt;
    }
    if (dateTo) {
      const dt = new Date(dateTo);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateTo filter' });
      createdAtFilter.$lte = dt;
    }
    if (Object.keys(createdAtFilter).length) baseMatch.createdAt = createdAtFilter;

    const sortKeyMap = { createdat: 'createdAt', salary: 'salaryAmount', status: 'status', role: 'roleTitle' };
    const sortBy = sortKeyMap[sortByRaw] || 'createdAt';
    const sortDir = sortDirRaw === 'asc' ? 1 : -1;

    const [
      total,
      statusRows,
      topRoles,
      salaryRows,
      recent
    ] = await Promise.all([
      PlacementOutcome.countDocuments(baseMatch),
      PlacementOutcome.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      PlacementOutcome.aggregate([
        { $match: baseMatch },
        { $group: { _id: '$roleTitle', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      PlacementOutcome.aggregate([
        { $match: { ...baseMatch, salaryAmount: { $ne: null } } },
        { $group: { _id: '$salaryCurrency', avgSalary: { $avg: '$salaryAmount' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      PlacementOutcome.find(baseMatch).sort({ [sortBy]: sortDir, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);

    const status = {
      applied: 0,
      screening: 0,
      interview: 0,
      offered: 0,
      hired: 0,
      'retained-90': 0
    };
    statusRows.forEach((row) => {
      if (status[row._id] !== undefined) status[row._id] = row.count;
    });

    return res.json({
      layer,
      institutionName,
      summary: {
        total,
        status,
        hiredRatePct: total ? Math.round(((status.hired + status['retained-90']) / total) * 100) : 0,
        retainedRatePct: total ? Math.round((status['retained-90'] / total) * 100) : 0
      },
      topRoles: topRoles.map((r) => ({ roleTitle: r._id, count: r.count })),
      averageSalaries: salaryRows,
      recentOutcomes: recent,
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit))
      },
      filters: {
        status: statusFilter || '',
        country: countryFilter || '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || ''
      },
      sorting: {
        sortBy,
        sortDir: sortDir === 1 ? 'asc' : 'desc'
      },
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Institution dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load institution dashboard' });
  }
});

router.get('/institutions/cohort-export', authenticateToken, async (req, res) => {
  try {
    const layer = normalizeAccessLayer(req.query.layer);
    const institutionName = String(req.query.institution || '').trim();
    const format = String(req.query.format || 'json').toLowerCase();
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const countryFilter = String(req.query.country || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    if (!layer || !institutionName) {
      return res.status(400).json({ error: 'layer and institution query params are required' });
    }

    const actor = await getAuthUser(req);
    const access = await assertInstitutionAccess({ req, actor, layer, institutionName, requiredRole: 'analyst' });
    if (!access.ok) {
      return res.status(403).json({ error: 'No permission to export this institution cohort' });
    }

    const filter = {
      sourceLayer: sourceLayerFromAccessLayer(layer),
      institutionName
    };

    if (statusFilter) {
      const allowedStatuses = new Set(['applied', 'screening', 'interview', 'offered', 'hired', 'retained-90']);
      if (!allowedStatuses.has(statusFilter)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      filter.status = statusFilter;
    }

    if (countryFilter) {
      filter.country = new RegExp(`^${countryFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    const createdAtFilter = {};
    if (dateFrom) {
      const dt = new Date(dateFrom);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateFrom filter' });
      createdAtFilter.$gte = dt;
    }
    if (dateTo) {
      const dt = new Date(dateTo);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateTo filter' });
      createdAtFilter.$lte = dt;
    }
    if (Object.keys(createdAtFilter).length) filter.createdAt = createdAtFilter;

    const rows = await PlacementOutcome.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (format === 'csv') {
      const headers = ['createdAt', 'sourceLayer', 'institutionName', 'roleTitle', 'status', 'salaryAmount', 'salaryCurrency', 'country', 'notes'];
      const csv = [
        asCsvRow(headers),
        ...rows.map((row) => asCsvRow([
          row.createdAt,
          row.sourceLayer,
          row.institutionName,
          row.roleTitle,
          row.status,
          row.salaryAmount,
          row.salaryCurrency,
          row.country,
          row.notes
        ]))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="cohort-${layer}-${institutionName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv"`);
      return res.send(csv);
    }

    return res.json({ layer, institutionName, count: rows.length, outcomes: rows });
  } catch (err) {
    console.error('Cohort export error:', err);
    return res.status(500).json({ error: 'Failed to export cohort outcomes' });
  }
});

router.get('/employers/verification/pending', authenticateToken, async (req, res) => {
  try {
    const actor = await getAuthUser(req);
    if (!isIntegrationAdminUser(actor)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const q = String(req.query.q || '').trim();

    const filter = { verificationStatus: 'pending', isActive: true };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { companyName: regex },
        { contactEmail: regex },
        { country: regex },
        { industry: regex }
      ];
    }

    const [total, pending] = await Promise.all([
      DiasporaEmployer.countDocuments(filter),
      DiasporaEmployer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
    ]);

    return res.json({
      count: pending.length,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      q,
      employers: pending
    });
  } catch (err) {
    console.error('Pending verification list error:', err);
    return res.status(500).json({ error: 'Failed to load pending verifications' });
  }
});

router.patch('/employers/verification/:id', authenticateToken, async (req, res) => {
  try {
    const actor = await getAuthUser(req);
    if (!isIntegrationAdminUser(actor)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const status = String(req.body?.status || '').trim().toLowerCase();
    const approvalNotes = String(req.body?.approvalNotes || '').trim();
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
    }

    const update = {
      verificationStatus: status,
      approvalNotes: approvalNotes || null,
      verifiedAt: status === 'approved' ? new Date() : null
    };

    const updated = await DiasporaEmployer.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ error: 'Diaspora employer not found' });

    await logIntegrationAudit(req, actor, {
      action: 'diaspora-employer-verification-updated',
      targetType: 'diaspora-employer',
      targetId: String(updated?._id || req.params.id),
      layer: 'employers',
      details: {
        status,
        approvalNotes,
        companyName: updated.companyName,
        country: updated.country
      }
    });

    return res.json({ success: true, employer: updated });
  } catch (err) {
    console.error('Employer verification update error:', err);
    return res.status(500).json({ error: 'Failed to update employer verification' });
  }
});

router.post('/placements/outcome', authenticateToken, async (req, res) => {
  try {
    const {
      userId,
      employerId,
      diasporaEmployerId,
      sourceLayer,
      institutionName,
      roleTitle,
      status,
      salaryAmount,
      salaryCurrency,
      country,
      notes
    } = req.body || {};

    if (!String(roleTitle || '').trim()) {
      return res.status(400).json({ error: 'roleTitle is required' });
    }

    const normalizedSourceLayer = String(sourceLayer || 'self-service').trim();
    const institutionNameTrimmed = String(institutionName || '').trim();
    const actor = await getAuthUser(req);

    if (normalizedSourceLayer !== 'self-service' && institutionNameTrimmed) {
      const accessLayer = accessLayerFromSourceLayer(normalizedSourceLayer);
      if (!accessLayer) return res.status(400).json({ error: 'Invalid sourceLayer' });
      const access = await assertInstitutionAccess({ req, actor, layer: accessLayer, institutionName: institutionNameTrimmed, requiredRole: 'analyst' });
      if (!access.ok) return res.status(403).json({ error: 'No permission to record outcomes for this institution' });
    }

    const payload = {
      userId: userId || null,
      employerId: employerId || null,
      diasporaEmployerId: diasporaEmployerId || null,
      sourceLayer: normalizedSourceLayer,
      institutionName: institutionNameTrimmed,
      roleTitle: String(roleTitle || '').trim(),
      status: status || 'applied',
      salaryAmount: Number.isFinite(Number(salaryAmount)) ? Number(salaryAmount) : null,
      salaryCurrency: String(salaryCurrency || 'JMD').trim().toUpperCase(),
      country: String(country || 'Jamaica').trim(),
      notes: String(notes || '').trim(),
      createdBy: req.user.userId
    };

    if (payload.status === 'hired') payload.hiredAt = new Date();
    if (payload.status === 'retained-90') {
      payload.hiredAt = new Date();
      payload.retainedAt = new Date();
    }

    const doc = await PlacementOutcome.create(payload);

    await logIntegrationAudit(req, actor, {
      action: 'placement-outcome-recorded',
      targetType: 'placement-outcome',
      targetId: String(doc?._id || ''),
      layer: payload.sourceLayer,
      institutionName: payload.institutionName,
      details: {
        roleTitle: payload.roleTitle,
        status: payload.status,
        salaryAmount: payload.salaryAmount,
        salaryCurrency: payload.salaryCurrency,
        country: payload.country
      }
    });

    return res.status(201).json({ success: true, outcome: doc });
  } catch (err) {
    console.error('Placement outcome create error:', err);
    return res.status(500).json({ error: 'Failed to create placement outcome' });
  }
});

router.patch('/placements/:id/status', authenticateToken, async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    const allowed = new Set(['applied', 'screening', 'interview', 'offered', 'hired', 'retained-90']);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const update = { status };
    if (status === 'hired') update.hiredAt = new Date();
    if (status === 'retained-90') {
      update.hiredAt = new Date();
      update.retainedAt = new Date();
    }

    const actor = await getAuthUser(req);
    const existing = await PlacementOutcome.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Placement outcome not found' });

    if (existing.sourceLayer !== 'self-service' && existing.institutionName) {
      const accessLayer = accessLayerFromSourceLayer(existing.sourceLayer);
      if (accessLayer) {
        const access = await assertInstitutionAccess({ req, actor, layer: accessLayer, institutionName: existing.institutionName, requiredRole: 'manager' });
        if (!access.ok) return res.status(403).json({ error: 'No permission to update this placement outcome' });
      }
    }

    const updated = await PlacementOutcome.findByIdAndUpdate(req.params.id, update, { new: true });
    await logIntegrationAudit(req, actor, {
      action: 'placement-outcome-status-updated',
      targetType: 'placement-outcome',
      targetId: String(updated?._id || req.params.id),
      layer: updated.sourceLayer,
      institutionName: updated.institutionName,
      details: { status }
    });

    return res.json({ success: true, outcome: updated });
  } catch (err) {
    console.error('Placement outcome update error:', err);
    return res.status(500).json({ error: 'Failed to update placement outcome' });
  }
});

router.get('/audit/recent', authenticateToken, async (req, res) => {
  try {
    const actor = await getAuthUser(req);
    if (!isIntegrationAdminUser(actor)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const action = String(req.query.action || '').trim();
    const q = String(req.query.q || '').trim();

    const filter = {};
    if (action) filter.action = action;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { actorEmail: regex },
        { targetType: regex },
        { targetId: regex },
        { institutionName: regex },
        { action: regex }
      ];
    }

    const [total, logs] = await Promise.all([
      IntegrationAuditLog.countDocuments(filter),
      IntegrationAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    return res.json({
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      logs
    });
  } catch (err) {
    console.error('Integration audit query error:', err);
    return res.status(500).json({ error: 'Failed to load audit log' });
  }
});

router.get('/audit/export', authenticateToken, async (req, res) => {
  try {
    const actor = await getAuthUser(req);
    if (!isIntegrationAdminUser(actor)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const action = String(req.query.action || '').trim();
    const q = String(req.query.q || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();

    const filter = {};
    if (action) filter.action = action;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { actorEmail: regex },
        { targetType: regex },
        { targetId: regex },
        { institutionName: regex },
        { action: regex }
      ];
    }

    const createdAtFilter = {};
    if (dateFrom) {
      const dt = new Date(dateFrom);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateFrom filter' });
      createdAtFilter.$gte = dt;
    }
    if (dateTo) {
      const dt = new Date(dateTo);
      if (Number.isNaN(dt.getTime())) return res.status(400).json({ error: 'Invalid dateTo filter' });
      createdAtFilter.$lte = dt;
    }
    if (Object.keys(createdAtFilter).length) filter.createdAt = createdAtFilter;

    const rows = await IntegrationAuditLog.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    const headers = ['createdAt', 'action', 'actorEmail', 'actorPlan', 'targetType', 'targetId', 'layer', 'institutionName', 'ip'];
    const csv = [
      asCsvRow(headers),
      ...rows.map((row) => asCsvRow([
        row.createdAt,
        row.action,
        row.actorEmail,
        row.actorPlan,
        row.targetType,
        row.targetId,
        row.layer,
        row.institutionName,
        row.ip
      ]))
    ].join('\n');

    await logIntegrationAudit(req, actor, {
      action: 'integration-audit-exported',
      targetType: 'integration-audit-log',
      targetId: 'csv-export',
      details: { rowCount: rows.length, actionFilter: action, q, dateFrom, dateTo }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="integration-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('Audit export error:', err);
    return res.status(500).json({ error: 'Failed to export audit log' });
  }
});

module.exports = router;
