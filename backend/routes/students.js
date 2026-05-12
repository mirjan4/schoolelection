const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { protect, superAdmin } = require('../middleware/auth');

// @GET /api/students
router.get('/', protect, async (req, res) => {
  try {
    const { search, boothId, class: cls, section, hasVoted } = req.query;
    let query = {};

    // Booth admin can only see their booth's students
    if (req.user.role === 'booth_admin') {
      query.boothId = req.user.boothId?._id || req.user.boothId;
    } else if (boothId) {
      query.boothId = boothId;
    }

    if (cls) query.class = cls;
    if (section) query.section = section;
    if (hasVoted === 'true') query.hasVotedClassLeader = true;
    if (hasVoted === 'false') query.hasVotedClassLeader = false;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { admissionNo: { $regex: search, $options: 'i' } },
      ];
    }

    const students = await Student.find(query).populate('boothId', 'name code').sort({ name: 1 });
    res.json({ success: true, data: students, count: students.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/students/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('boothId', 'name code');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/students
router.post('/', protect, superAdmin, async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/students/:id
router.put('/:id', protect, superAdmin, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/students/:id
router.delete('/:id', protect, superAdmin, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/students/bulk-transfer
router.post('/bulk-transfer', protect, superAdmin, async (req, res) => {
  try {
    const { studentIds, targetBoothId } = req.body;
    if (!studentIds || !targetBoothId) return res.status(400).json({ success: false, message: 'Missing fields' });

    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $set: { boothId: targetBoothId } }
    );

    // Emit realtime update to all clients
    if (req.app.get('io')) {
      req.app.get('io').emit('booth_assignment_changed', { studentIds, targetBoothId });
    }

    res.json({ success: true, message: `Successfully transferred ${studentIds.length} students` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
