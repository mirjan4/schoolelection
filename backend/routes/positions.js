const express = require('express');
const router = express.Router();
const Position = require('../models/Position');
const { protect, superAdmin } = require('../middleware/auth');

// @GET /api/positions
// Get all positions sorted by display order
router.get('/', protect, async (req, res) => {
  try {
    const { active } = req.query;
    const query = {};
    if (active !== undefined) {
      query.active = active === 'true';
    }
    const positions = await Position.find(query).sort({ displayOrder: 1, createdAt: 1 });
    res.json({ success: true, data: positions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/positions
// Create a new position (Super Admin only)
router.post('/', protect, superAdmin, async (req, res) => {
  try {
    const position = await Position.create(req.body);
    res.status(201).json({ success: true, data: position });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/positions/:id
// Update position details (Super Admin only)
router.put('/:id', protect, superAdmin, async (req, res) => {
  try {
    const position = await Position.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!position) {
      return res.status(404).json({ success: false, message: 'Position not found' });
    }
    res.json({ success: true, data: position });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/positions/:id
// Delete a position (Super Admin only)
router.delete('/:id', protect, superAdmin, async (req, res) => {
  try {
    const position = await Position.findByIdAndDelete(req.params.id);
    if (!position) {
      return res.status(404).json({ success: false, message: 'Position not found' });
    }
    res.json({ success: true, message: 'Position deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
