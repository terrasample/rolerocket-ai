const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authenticateToken = require('../middleware/auth');
const User = require('../models/User');
const NetworkingConnection = require('../models/NetworkingConnection');

// ── GET /api/networking/profile — get own networking profile ─────────────────
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('networkingProfile name email').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: user.networkingProfile || {}, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/networking/profile — update own networking profile ──────────────
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { optedIn, displayName, title, industry, location, bio, skills, linkedIn } = req.body;
    const update = {
      'networkingProfile.optedIn':     Boolean(optedIn),
      'networkingProfile.displayName': String(displayName || '').trim().slice(0, 80),
      'networkingProfile.title':       String(title || '').trim().slice(0, 100),
      'networkingProfile.industry':    String(industry || '').trim().slice(0, 80),
      'networkingProfile.location':    String(location || '').trim().slice(0, 80),
      'networkingProfile.bio':         String(bio || '').trim().slice(0, 400),
      'networkingProfile.skills':      (Array.isArray(skills) ? skills : String(skills || '').split(','))
                                         .map((s) => String(s).trim()).filter(Boolean).slice(0, 15),
      'networkingProfile.linkedIn':    String(linkedIn || '').trim().slice(0, 200),
      'networkingProfile.updatedAt':   new Date()
    };
    await User.findByIdAndUpdate(req.user.id, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/networking/directory — browse opted-in professionals ────────────
router.get('/directory', authenticateToken, async (req, res) => {
  try {
    const { industry, role, location, page = 1 } = req.query;
    const PAGE_SIZE = 20;
    const skip = (Math.max(1, Number(page)) - 1) * PAGE_SIZE;

    const filter = { 'networkingProfile.optedIn': true, _id: { $ne: req.user.id } };
    if (industry) filter['networkingProfile.industry'] = { $regex: String(industry).trim(), $options: 'i' };
    if (role)     filter['networkingProfile.title']    = { $regex: String(role).trim(), $options: 'i' };
    if (location) filter['networkingProfile.location'] = { $regex: String(location).trim(), $options: 'i' };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('networkingProfile name')
        .sort({ 'networkingProfile.updatedAt': -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .lean(),
      User.countDocuments(filter)
    ]);

    // Look up connection status between current user and each result
    const ids = users.map((u) => u._id);
    const connections = await NetworkingConnection.find({
      $or: [
        { fromUser: req.user.id, toUser: { $in: ids } },
        { toUser: req.user.id, fromUser: { $in: ids } }
      ]
    }).lean();

    const connMap = {};
    for (const c of connections) {
      const otherId = String(c.fromUser) === String(req.user.id)
        ? String(c.toUser) : String(c.fromUser);
      connMap[otherId] = c.status;
    }

    const professionals = users.map((u) => ({
      id:       String(u._id),
      name:     u.networkingProfile.displayName || u.name,
      title:    u.networkingProfile.title || '',
      industry: u.networkingProfile.industry || '',
      location: u.networkingProfile.location || '',
      bio:      u.networkingProfile.bio || '',
      skills:   u.networkingProfile.skills || [],
      linkedIn: u.networkingProfile.linkedIn || '',
      connectionStatus: connMap[String(u._id)] || null
    }));

    res.json({ professionals, total, page: Number(page), pageSize: PAGE_SIZE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/networking/connect — send connection request ───────────────────
router.post('/connect', authenticateToken, async (req, res) => {
  try {
    const toUserId = String(req.body.toUserId || '').trim();
    if (!toUserId || toUserId === String(req.user.id)) {
      return res.status(400).json({ error: 'Invalid target user.' });
    }
    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const toUser = await User.findById(toUserId).lean();
    if (!toUser || !toUser.networkingProfile?.optedIn) {
      return res.status(404).json({ error: 'Professional not found.' });
    }

    // Check for existing connection in either direction
    const existing = await NetworkingConnection.findOne({
      $or: [
        { fromUser: req.user.id, toUser: toUserId },
        { fromUser: toUserId, toUser: req.user.id }
      ]
    });

    if (existing) {
      return res.status(409).json({ error: 'Connection already exists.', status: existing.status });
    }

    const conn = await NetworkingConnection.create({
      fromUser: req.user.id,
      toUser:   toUserId,
      status:   'pending'
    });

    res.json({ ok: true, connectionId: String(conn._id), status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/networking/connect/:id — accept or decline request ──────────────
router.put('/connect/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be accepted or declined.' });
    }
    const conn = await NetworkingConnection.findById(req.params.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found.' });
    if (String(conn.toUser) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    conn.status = status;
    await conn.save();
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/networking/connections — list my connections ────────────────────
router.get('/connections', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query; // 'pending' | 'accepted' | all
    const filter = {
      $or: [{ fromUser: req.user.id }, { toUser: req.user.id }]
    };
    if (status) filter.status = status;

    const conns = await NetworkingConnection.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    // Collect all peer IDs to look up profiles in one query
    const peerIds = conns.map((c) =>
      String(c.fromUser) === String(req.user.id) ? c.toUser : c.fromUser
    );
    const peers = await User.find({ _id: { $in: peerIds } })
      .select('networkingProfile name')
      .lean();
    const peerMap = {};
    for (const p of peers) {
      peerMap[String(p._id)] = { name: p.networkingProfile?.displayName || p.name, title: p.networkingProfile?.title || '', industry: p.networkingProfile?.industry || '', location: p.networkingProfile?.location || '' };
    }

    const list = conns.map((c) => {
      const peerId = String(c.fromUser) === String(req.user.id) ? String(c.toUser) : String(c.fromUser);
      const direction = String(c.fromUser) === String(req.user.id) ? 'outgoing' : 'incoming';
      return {
        connectionId: String(c._id),
        peerId,
        peer:         peerMap[peerId] || { name: 'Unknown', title: '', industry: '', location: '' },
        status:       c.status,
        direction,
        messageCount: c.messages.length,
        lastMessage:  c.messages.length ? c.messages[c.messages.length - 1].text.slice(0, 80) : null,
        updatedAt:    c.updatedAt
      };
    });

    res.json({ connections: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/networking/messages/:connectionId — get message thread ──────────
router.get('/messages/:connectionId', authenticateToken, async (req, res) => {
  try {
    const conn = await NetworkingConnection.findById(req.params.connectionId).lean();
    if (!conn) return res.status(404).json({ error: 'Connection not found.' });
    if (String(conn.fromUser) !== String(req.user.id) && String(conn.toUser) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    if (conn.status !== 'accepted') {
      return res.status(403).json({ error: 'Connection not yet accepted.' });
    }
    res.json({ messages: conn.messages || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/networking/messages/:connectionId — send a message ─────────────
router.post('/messages/:connectionId', authenticateToken, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });

    const conn = await NetworkingConnection.findById(req.params.connectionId);
    if (!conn) return res.status(404).json({ error: 'Connection not found.' });
    if (String(conn.fromUser) !== String(req.user.id) && String(conn.toUser) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized.' });
    }
    if (conn.status !== 'accepted') {
      return res.status(403).json({ error: 'Connection must be accepted before messaging.' });
    }

    conn.messages.push({ sender: req.user.id, text });
    await conn.save();
    const msg = conn.messages[conn.messages.length - 1];
    res.json({ ok: true, message: { id: String(msg._id), sender: String(req.user.id), text: msg.text, createdAt: msg.createdAt } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
