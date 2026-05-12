const express = require('express');
const router = express.Router();
const Booth = require('../models/Booth');
const { protect, superAdmin } = require('../middleware/auth');

// @GET /api/booths
router.get('/', protect, async (req, res) => {
  try {
    const booths = await Booth.find().sort({ createdAt: -1 });
    res.json({ success: true, data: booths });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/booths/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const booth = await Booth.findById(req.params.id);
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });
    res.json({ success: true, data: booth });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/booths
router.post('/', protect, superAdmin, async (req, res) => {
  try {
    const booth = await Booth.create(req.body);
    res.status(201).json({ success: true, data: booth });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/booths/:id
router.put('/:id', protect, superAdmin, async (req, res) => {
  try {
    const booth = await Booth.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });
    res.json({ success: true, data: booth });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/booths/:id
router.delete('/:id', protect, superAdmin, async (req, res) => {
  try {
    const booth = await Booth.findByIdAndDelete(req.params.id);
    if (!booth) return res.status(404).json({ success: false, message: 'Booth not found' });
    res.json({ success: true, message: 'Booth deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
