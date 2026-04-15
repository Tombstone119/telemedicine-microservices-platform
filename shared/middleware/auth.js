const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id && decoded.sub) {
      decoded.id = decoded.sub;
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

function requireRole(...roles) {
  const normalizedRoles = roles.flat();
  return (req, res, next) => {
    if (!normalizedRoles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
