const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const Student = require('../models/Student');
const Candidate = require('../models/Candidate');
const LiveSession = require('../models/LiveSession');
const { protect } = require('../middleware/auth');

// @POST /api/votes
router.post('/', protect, async (req, res) => {
  try {
    const { studentId, candidateId, electionType, boothId } = req.body;

    // Validate session
    const session = await LiveSession.findOne({ boothId });
    if (!session || session.status !== 'voting') {
      return res.status(400).json({ success: false, message: 'No active voting session' });
    }
    if (String(session.currentStudent) !== String(studentId)) {
      return res.status(400).json({ success: false, message: 'Session student mismatch' });
    }

    // Check duplicate vote
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const resolvedPositionId = req.body.positionId || candidate.positionId;

    if (resolvedPositionId) {
      // College Mode vote validation
      const Position = require('../models/Position');
      const positionObj = await Position.findById(resolvedPositionId);
      if (!positionObj) return res.status(404).json({ success: false, message: 'Position not found' });

      // Check duplicate vote for the exact same candidate
      const duplicateCandVote = await Vote.findOne({ studentId, candidateId });
      if (duplicateCandVote) {
        return res.status(400).json({ success: false, message: 'Already voted for this candidate' });
      }

      // Check max votes limit for this position
      const castCount = await Vote.countDocuments({ studentId, positionId: resolvedPositionId });
      if (castCount >= positionObj.maxVotes) {
        return res.status(400).json({ success: false, message: `Maximum votes (${positionObj.maxVotes}) already cast for position ${positionObj.name}` });
      }
    } else {
      // School Mode vote validation
      if (electionType === 'class_leader' && student.hasVotedClassLeader) {
        return res.status(400).json({ success: false, message: 'Already voted for Class Leader' });
      }
      if (electionType === 'school_leader' && student.hasVotedSchoolLeader) {
        return res.status(400).json({ success: false, message: 'Already voted for School Leader' });
      }
    }

    // Save vote
    const voteData = { studentId, candidateId, electionType, boothId };
    if (resolvedPositionId) voteData.positionId = resolvedPositionId;
    const vote = await Vote.create(voteData);

    // Update student flags
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
    
    if (Object.keys(update).length > 0) {
      await Student.findByIdAndUpdate(studentId, update);
    }

    // Increment candidate vote count
    await Candidate.findByIdAndUpdate(candidateId, { $inc: { voteCount: 1 } });

    // Emit realtime update
    const io = req.io;
    if (io) {
      io.to(`booth_${boothId}`).emit('vote_cast', {
        electionType,
        studentId,
        candidateId,
      });
      // Emit global stats update
      io.emit('stats_update', { boothId });
    }

    res.status(201).json({ success: true, data: vote });
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
