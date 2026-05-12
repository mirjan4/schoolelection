const express = require('express');
const router = express.Router();
const Election = require('../models/Election');
const LiveSession = require('../models/LiveSession');
const Student = require('../models/Student');
const Booth = require('../models/Booth');
const { protect, superAdmin, boothAdmin } = require('../middleware/auth');

// @GET /api/election/status
router.get('/status', async (req, res) => {
  try {
    const election = await Election.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: election || { status: 'not_started' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/election/start
router.post('/start', protect, superAdmin, async (req, res) => {
  try {
    const { title, scheduledEnd } = req.body;
    let election = await Election.findOne().sort({ createdAt: -1 });

    if (election && election.status === 'active') {
      return res.status(400).json({ success: false, message: 'Election already active' });
    }

    election = await Election.create({
      title: title || 'School Election',
      status: 'active',
      startedAt: new Date(),
      scheduledEnd: scheduledEnd || null,
      createdBy: req.user._id,
    });

    req.io.emit('election_started', { election });
    res.status(201).json({ success: true, data: election });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/election/stop
router.post('/stop', protect, superAdmin, async (req, res) => {
  try {
    const election = await Election.findOneAndUpdate(
      { status: 'active' },
      { status: 'ended', endedAt: new Date() },
      { new: true }
    );
    if (!election) return res.status(404).json({ success: false, message: 'No active election' });

    req.io.emit('election_ended', { election });
    res.json({ success: true, data: election });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/election/session/start
// Booth Admin starts a voting session for a student
router.post('/session/start', protect, boothAdmin, async (req, res) => {
  try {
    const { studentId } = req.body;
    const boothId = req.user.boothId?._id || req.user.boothId;

    if (!boothId) return res.status(400).json({ success: false, message: 'No booth assigned' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (student.hasVotedClassLeader && student.hasVotedSchoolLeader) {
      return res.status(400).json({ success: false, message: 'Student has already voted' });
    }

    // Upsert live session
    const session = await LiveSession.findOneAndUpdate(
      { boothId },
      {
        boothId,
        currentStudent: studentId,
        status: 'voting',
        startedAt: new Date(),
        completedAt: null,
      },
      { upsert: true, new: true }
    );

    const populatedSession = await LiveSession.findById(session._id)
      .populate('currentStudent')
      .populate('boothId');

    // Emit to voting device in this booth's room
    req.io.to(`booth_${boothId}`).emit('voting_started', {
      session: populatedSession,
      student,
    });

    // Notify admins
    req.io.to('admins').emit('session_update', { boothId, status: 'voting', student });

    res.json({ success: true, data: populatedSession });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/election/session/complete
router.post('/session/complete', protect, async (req, res) => {
  try {
    const boothId = req.body.boothId || req.user.boothId?._id || req.user.boothId;

    const session = await LiveSession.findOneAndUpdate(
      { boothId },
      { status: 'completed', completedAt: new Date() },
      { new: true }
    );

    req.io.to(`booth_${boothId}`).emit('voting_completed', { boothId });
    req.io.to('admins').emit('session_update', { boothId, status: 'completed' });

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/election/session/reset
router.post('/session/reset', protect, boothAdmin, async (req, res) => {
  try {
    const boothId = req.user.boothId?._id || req.user.boothId;
    const session = await LiveSession.findOneAndUpdate(
      { boothId },
      { status: 'idle', currentStudent: null, startedAt: null, completedAt: null },
      { upsert: true, new: true }
    );
    req.io.to(`booth_${boothId}`).emit('session_reset', { boothId });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/election/session/:boothId
router.get('/session/:boothId', protect, async (req, res) => {
  try {
    const session = await LiveSession.findOne({ boothId: req.params.boothId })
      .populate('currentStudent')
      .populate('boothId');
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/election/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const boothId = req.user.role === 'booth_admin'
      ? (req.user.boothId?._id || req.user.boothId)
      : null;

    const studentQuery = boothId ? { boothId } : {};
    const voteQuery = boothId ? { boothId } : {};

    const [totalStudents, totalVoted, totalVotes, booths] = await Promise.all([
      Student.countDocuments(studentQuery),
      Student.countDocuments({ ...studentQuery, hasVotedClassLeader: true, hasVotedSchoolLeader: true }),
      require('../models/Vote').countDocuments(voteQuery),
      boothId ? [] : Booth.find({ active: true }),
    ]);

    let boothStats = [];
    if (!boothId) {
      boothStats = await Promise.all(booths.map(async (b) => {
        const [bs, bv] = await Promise.all([
          Student.countDocuments({ boothId: b._id }),
          Student.countDocuments({ boothId: b._id, hasVotedClassLeader: true, hasVotedSchoolLeader: true }),
        ]);

        let status = 'balanced';
        if (bs > b.maxVoters) status = 'overloaded';
        else if (bs > b.maxVoters * 0.8) status = 'near_capacity';
        else if (bs < b.minVoters) status = 'underloaded';

        return {
          booth: b,
          totalStudents: bs,
          totalVoted: bv,
          turnout: bs > 0 ? Math.round((bv / bs) * 100) : 0,
          status,
          capacityPercent: Math.round((bs / b.maxVoters) * 100),
          minVoters: b.minVoters,
          maxVoters: b.maxVoters
        };
      }));
    }

    res.json({
      success: true,
      data: {
        totalStudents,
        totalVoted,
        totalVotes,
        turnout: totalStudents > 0 ? Math.round((totalVoted / totalStudents) * 100) : 0,
        boothStats,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
