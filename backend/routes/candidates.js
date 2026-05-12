const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Candidate = require('../models/Candidate');
const { protect, superAdmin } = require('../middleware/auth');

// Multer config for candidate photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/candidates/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// @GET /api/candidates
router.get('/', protect, async (req, res) => {
  try {
    const { electionType, active } = req.query;
    const query = {};
    if (electionType) query.electionType = electionType;
    if (active !== undefined) query.active = active === 'true';
    const candidates = await Candidate.find(query).sort({ name: 1 });
    res.json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/candidates
router.post('/', protect, superAdmin, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = `/uploads/candidates/${req.file.filename}`;
    const candidate = await Candidate.create(data);
    res.status(201).json({ success: true, data: candidate });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/candidates/:id
router.put('/:id', protect, superAdmin, upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photo = `/uploads/candidates/${req.file.filename}`;
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, data, {
      new: true, runValidators: true,
    });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/candidates/:id
router.delete('/:id', protect, superAdmin, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, message: 'Candidate deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
