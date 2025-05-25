const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

exports.generateToken = (user) => {
  const payload = {
    userId: user.id || user._id,
    email: user.email,
    role: user.role || 'user',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

exports.generateRefreshToken = (user) => {
  const payload = {
    userId: user.id || user._id,
    type: 'refresh',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
};

exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = this.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
  
  req.user = decoded;
  next();
};