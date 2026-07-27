const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Candidate = require('../models/Candidate');
const { protect, superAdmin } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/candidates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const candidateUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'symbolImage', maxCount: 1 },
]);

const handleUpload = (req, res, next) => {
  candidateUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Data sanitizer for candidate payloads
const cleanCandidateData = (req) => {
  const data = { ...req.body };

  // Sanitize positionId for ObjectId field
  if (!data.positionId || data.positionId === '' || data.positionId === 'null' || data.positionId === 'undefined') {
    data.positionId = null;
  }

  // Sanitize numeric fields
  if (data.displayOrder !== undefined) {
    if (data.displayOrder === '' || isNaN(Number(data.displayOrder))) {
      data.displayOrder = 0;
    } else {
      data.displayOrder = Number(data.displayOrder);
    }
  }

  // Sanitize boolean fields
  if (data.active !== undefined) {
    data.active = data.active === 'true' || data.active === true;
  }

  // Handle uploaded files
  if (req.files?.photo?.[0]) {
    data.photo = `/uploads/candidates/${req.files.photo[0].filename}`;
  } else if (data.photo === '' || data.photo === 'null' || data.photo === 'undefined') {
    delete data.photo;
  }

  if (req.files?.symbolImage?.[0]) {
    data.symbolImage = `/uploads/candidates/${req.files.symbolImage[0].filename}`;
  } else if (data.symbolImage === '' || data.symbolImage === 'null' || data.symbolImage === 'undefined') {
    delete data.symbolImage;
  }

  return data;
};

// @GET /api/candidates
router.get('/', async (req, res) => {
  try {
    const { electionType, positionId, active } = req.query;
    const query = {};
    if (electionType) query.electionType = electionType;
    if (positionId) query.positionId = positionId;
    if (active !== undefined) query.active = active === 'true';
    const candidates = await Candidate.find(query).populate('positionId').sort({ displayOrder: 1, name: 1 });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/candidates
router.post('/', protect, superAdmin, handleUpload, async (req, res) => {
  try {
    const data = cleanCandidateData(req);
    const candidate = await Candidate.create(data);
    res.status(201).json({ success: true, data: candidate });
  } catch (err) {
    console.error('Candidate Create Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/candidates/:id
router.put('/:id', protect, superAdmin, handleUpload, async (req, res) => {
  try {
    const data = cleanCandidateData(req);
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    res.json({ success: true, data: candidate });
  } catch (err) {
    console.error('Candidate Update Error:', err);
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
    console.error('Candidate Delete Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
