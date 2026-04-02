const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // Expect: "Bearer TOKEN"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.id || decoded._id || decoded.sub || null
    };

    if (!req.user.userId) {
      return res.status(403).json({ error: 'Invalid token payload' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;