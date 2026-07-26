const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const Student = require('../models/Student');
const Candidate = require('../models/Candidate');
const LiveSession = require('../models/LiveSession');
const Position = require('../models/Position');
const { protect } = require('../middleware/auth');

// @POST /api/votes (Single Vote Cast - Ultra-Optimized < 50ms)
router.post('/', protect, async (req, res) => {
  const t0 = performance.now();
  let valTime = 0, dbTime = 0, statsTime = 0, socketTime = 0;
  const tValStart = performance.now();

  try {
    const { studentId, candidateId, electionType } = req.body;
    const targetBoothId = req.user.role === 'device' ? req.user.boothId : (req.body.boothId || req.user.boothId);

    if (!targetBoothId) {
      return res.status(400).json({ success: false, message: 'Booth ID required' });
    }

    const candidate = await Candidate.findById(candidateId).lean();
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const resolvedPositionId = req.body.positionId || candidate.positionId;

    // Parallel Lean Validation Queries
    const [session, student, positionObj, duplicateCandVote, castCount] = await Promise.all([
      LiveSession.findOne({ boothId: targetBoothId }).lean(),
      Student.findById(studentId).lean(),
      resolvedPositionId ? Position.findById(resolvedPositionId).lean() : Promise.resolve(null),
      resolvedPositionId ? Vote.findOne({ studentId, candidateId }).lean() : Promise.resolve(null),
      resolvedPositionId ? Vote.countDocuments({ studentId, positionId: resolvedPositionId }) : Promise.resolve(0),
    ]);

    valTime = Number((performance.now() - tValStart).toFixed(2));

    if (!session || session.status !== 'voting') {
      return res.status(400).json({ success: false, message: 'No active voting session' });
    }
    if (String(session.currentStudent) !== String(studentId)) {
      return res.status(400).json({ success: false, message: 'Session student mismatch' });
    }
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const boothId = targetBoothId;

    if (resolvedPositionId) {
      if (!positionObj) return res.status(404).json({ success: false, message: 'Position not found' });
      if (duplicateCandVote) {
        return res.status(400).json({ success: false, message: 'Already voted for this candidate' });
      }
      if (castCount >= positionObj.maxVotes) {
        return res.status(400).json({ success: false, message: `Maximum votes (${positionObj.maxVotes}) already cast for position ${positionObj.name}` });
      }
    } else {
      if (electionType === 'class_leader' && student.hasVotedClassLeader) {
        return res.status(400).json({ success: false, message: 'Already voted for Class Leader' });
      }
      if (electionType === 'school_leader' && student.hasVotedSchoolLeader) {
        return res.status(400).json({ success: false, message: 'Already voted for School Leader' });
      }
    }

    // Parallel DB Commit (Vote Create + Candidate Inc + Student Update)
    const tDbStart = performance.now();
    const voteData = { studentId, candidateId, electionType, boothId };
    if (resolvedPositionId) voteData.positionId = resolvedPositionId;

    const update = {};
    if (resolvedPositionId) {
      if (req.body.isLastVote) {
        update.hasVotedCollege = true;
        update.votedAt = new Date();
      }
    } else {
      if (electionType === 'class_leader') update.hasVotedClassLeader = true;
      if (electionType === 'school_leader') {
        update.hasVotedSchoolLeader = true;
        update.votedAt = new Date();
      }
    }

    const [vote] = await Promise.all([
      Vote.create(voteData),
      Candidate.findByIdAndUpdate(candidateId, { $inc: { voteCount: 1 } }),
      Object.keys(update).length > 0 ? Student.findByIdAndUpdate(studentId, update) : Promise.resolve(null),
    ]);

    dbTime = Number((performance.now() - tDbStart).toFixed(2));
    const totalApiTime = Number((performance.now() - t0).toFixed(2));

    // Return HTTP 201 Response IMMEDIATELY
    res.status(201).json({ success: true, data: vote });

    // Asynchronous Background Socket Broadcasts (Non-blocking)
    setImmediate(() => {
      const tAsync = performance.now();
      const io = req.io;
      if (io) {
        io.to(`booth_${boothId}`).emit('vote_cast', { electionType, studentId, candidateId });
        io.emit('stats_update', { boothId });
      }
      socketTime = Number((performance.now() - tAsync).toFixed(2));
      statsTime = socketTime;

      console.log(`\n=== VOTE CAST TIMING REPORT ===`);
      console.log(`- Validation: ${valTime} ms`);
      console.log(`- Database Save: ${dbTime} ms`);
      console.log(`- Statistics Update: ${statsTime} ms`);
      console.log(`- Socket Emit: ${socketTime} ms`);
      console.log(`- Total API Time: ${totalApiTime} ms`);
      console.log(`===============================\n`);
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate vote detected' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/votes/bulk (Multi-Vote Batch Cast - Ultra Fast < 50ms)
router.post('/bulk', protect, async (req, res) => {
  const t0 = performance.now();
  let valTime = 0, dbTime = 0, statsTime = 0, socketTime = 0;
  const tValStart = performance.now();

  try {
    const { votes, studentId, boothId: bodyBoothId } = req.body;
    const boothId = req.user.role === 'device' ? req.user.boothId : (bodyBoothId || req.user.boothId);

    if (!votes || !Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ success: false, message: 'No votes provided' });
    }

    const [session, student] = await Promise.all([
      LiveSession.findOne({ boothId }).lean(),
      Student.findById(studentId).lean(),
    ]);

    valTime = Number((performance.now() - tValStart).toFixed(2));

    if (!session || session.status !== 'voting') {
      return res.status(400).json({ success: false, message: 'No active voting session' });
    }
    if (String(session.currentStudent) !== String(studentId)) {
      return res.status(400).json({ success: false, message: 'Session student mismatch' });
    }
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Database Bulk Save Step
    const tDbStart = performance.now();
    const candidateIncMap = {};
    const voteDocs = votes.map((v) => {
      const candId = String(v.candidateId);
      candidateIncMap[candId] = (candidateIncMap[candId] || 0) + 1;
      return {
        studentId,
        candidateId: v.candidateId,
        electionType: v.electionType || 'college',
        positionId: v.positionId || null,
        boothId,
      };
    });

    const candUpdatePromises = Object.entries(candidateIncMap).map(([candId, count]) =>
      Candidate.findByIdAndUpdate(candId, { $inc: { voteCount: count } })
    );

    const studentUpdate = {
      hasVotedCollege: true,
      hasVotedClassLeader: true,
      hasVotedSchoolLeader: true,
      votedAt: new Date(),
    };

    const [createdVotes] = await Promise.all([
      Vote.insertMany(voteDocs, { ordered: false }),
      Student.findByIdAndUpdate(studentId, studentUpdate),
      Promise.all(candUpdatePromises),
    ]);

    dbTime = Number((performance.now() - tDbStart).toFixed(2));
    const totalApiTime = Number((performance.now() - t0).toFixed(2));

    // Return response IMMEDIATELY
    res.status(201).json({ success: true, count: createdVotes.length, data: createdVotes });

    // Asynchronous background Socket broadcast
    setImmediate(() => {
      const tAsync = performance.now();
      if (req.io) {
        req.io.to(`booth_${boothId}`).emit('vote_cast', { studentId, bulk: true });
        req.io.emit('stats_update', { boothId });
      }
      socketTime = Number((performance.now() - tAsync).toFixed(2));
      statsTime = socketTime;

      console.log(`\n=== BULK VOTE TIMING REPORT ===`);
      console.log(`- Validation: ${valTime} ms`);
      console.log(`- Database Save (${createdVotes.length} votes): ${dbTime} ms`);
      console.log(`- Statistics Update: ${statsTime} ms`);
      console.log(`- Socket Emit: ${socketTime} ms`);
      console.log(`- Total API Time: ${totalApiTime} ms`);
      console.log(`===============================\n`);
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate vote detected' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/votes/booth/:boothId
router.get('/booth/:boothId', protect, async (req, res) => {
  try {
    const votes = await Vote.find({ boothId: req.params.boothId })
      .populate('studentId', 'name admissionNo class section')
      .populate('candidateId', 'name symbol electionType')
      .sort({ timestamp: -1 });
    res.json({ success: true, data: votes, count: votes.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
