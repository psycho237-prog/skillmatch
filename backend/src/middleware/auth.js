const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_skillmatch';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden. Invalid token.' });
    req.user = user;
    next();
  });
};

const generateToken = (user) => {
  return jwt.sign({ id: user.id, phone_number: user.phone_number }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { authenticateToken, generateToken, JWT_SECRET };
