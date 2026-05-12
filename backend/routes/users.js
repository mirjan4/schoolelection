const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, superAdmin } = require('../middleware/auth');

// @GET /api/users
router.get('/', protect, superAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'booth_admin' }).populate('boothId', 'name code');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/users
router.post('/', protect, superAdmin, async (req, res) => {
  try {
    const user = await User.create(req.body);
    const populated = await User.findById(user._id).populate('boothId', 'name code');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/users/:id
router.put('/:id', protect, superAdmin, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    Object.assign(user, rest);
    if (password) user.password = password;
    await user.save();

    const populated = await User.findById(user._id).populate('boothId', 'name code');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/users/:id
router.delete('/:id', protect, superAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
