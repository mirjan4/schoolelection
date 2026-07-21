const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if the token belongs to a voting device
    if (typeof decoded.id === 'string' && decoded.id.startsWith('device_')) {
      const boothId = decoded.id.replace('device_', '');
      const Booth = require('../models/Booth');
      const booth = await Booth.findById(boothId);
      if (!booth || !booth.active) {
        return res.status(401).json({ success: false, message: 'Device booth inactive or not found' });
      }
      // Populate req.user with virtual device profile
      req.user = {
        _id: decoded.id,
        role: 'device',
        boothId: booth._id,
        isActive: true,
      };
      return next();
    }

    req.user = await User.findById(decoded.id).populate('boothId');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    if (!req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
  }
};

const superAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
};

const boothAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'booth_admin' || req.user.role === 'super_admin')) return next();
  return res.status(403).json({ success: false, message: 'Access denied. Booth Admin required.' });
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

module.exports = { protect, superAdmin, boothAdmin, generateToken };
