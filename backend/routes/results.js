const express = require('express');
const router = express.Router();
const Vote = require('../models/Vote');
const Candidate = require('../models/Candidate');
const Student = require('../models/Student');
const Booth = require('../models/Booth');
const { protect, superAdmin } = require('../middleware/auth');

// @GET /api/results
router.get('/', protect, superAdmin, async (req, res) => {
  try {
    const Election = require('../models/Election');
    const election = await Election.findOne().sort({ createdAt: -1 });
    const isCollege = election && election.type === 'college';

    const candidates = await Candidate.find({ active: true }).populate('positionId').sort({ voteCount: -1 });

    const withPercent = (list, total) =>
      list.map(c => ({
        ...c.toObject(),
        percentage: total > 0 ? Math.round((c.voteCount / total) * 100) : 0,
      }));

    // Booth-wise breakdown
    const booths = await Booth.find({ active: true });
    const votedFilter = isCollege ? { hasVotedCollege: true } : { hasVotedClassLeader: true, hasVotedSchoolLeader: true };

    const boothResults = await Promise.all(booths.map(async (b) => {
      const [totalStudents, voted] = await Promise.all([
        Student.countDocuments({ boothId: b._id }),
        Student.countDocuments({ boothId: b._id, ...votedFilter }),
      ]);
      const votes = await Vote.countDocuments({ boothId: b._id });
      return {
        booth: { _id: b._id, name: b.name, code: b.code },
        totalStudents,
        voted,
        votes,
        turnout: totalStudents > 0 ? Math.round((voted / totalStudents) * 100) : 0,
      };
    }));

    // Class-wise turnout
    const classes = await Student.distinct('class');
    const classTurnout = await Promise.all(classes.map(async (cls) => {
      const [total, voted] = await Promise.all([
        Student.countDocuments({ class: cls }),
        Student.countDocuments({ class: cls, ...votedFilter }),
      ]);
      return { class: cls, total, voted, turnout: total > 0 ? Math.round((voted / total) * 100) : 0 };
    }));

    if (isCollege) {
      const Position = require('../models/Position');
      const positions = await Position.find({ active: true }).sort({ displayOrder: 1 });

      const positionResults = positions.map(pos => {
        const posCandidates = candidates.filter(c => c.positionId && String(c.positionId._id) === String(pos._id));
        const totalVotes = posCandidates.reduce((sum, c) => sum + c.voteCount, 0);

        const candWithPercent = posCandidates.map(c => ({
          ...c.toObject(),
          percentage: totalVotes > 0 ? Math.round((c.voteCount / totalVotes) * 100) : 0,
        })).sort((a, b) => b.voteCount - a.voteCount);

        return {
          position: pos,
          totalVotes,
          candidates: candWithPercent,
        };
      });

      return res.json({
        success: true,
        data: {
          electionType: 'college',
          positionResults,
          boothResults,
          classTurnout: classTurnout.sort((a, b) => a.class.localeCompare(b.class)),
        }
      });
    }

    const classLeaders = candidates.filter(c => c.electionType === 'class_leader');
    const schoolLeaders = candidates.filter(c => c.electionType === 'school_leader');

    const totalClassVotes = classLeaders.reduce((s, c) => s + c.voteCount, 0);
    const totalSchoolVotes = schoolLeaders.reduce((s, c) => s + c.voteCount, 0);

    // Group class leaders by class
    const classWiseResults = {};
    classLeaders.forEach(c => {
      const cls = c.class || 'Other';
      if (!classWiseResults[cls]) {
        classWiseResults[cls] = { candidates: [], totalVotes: 0 };
      }
      classWiseResults[cls].candidates.push(c);
      classWiseResults[cls].totalVotes += c.voteCount;
    });

    // Add percentage to each class leader candidate
    Object.keys(classWiseResults).forEach(cls => {
      const total = classWiseResults[cls].totalVotes;
      classWiseResults[cls].candidates = classWiseResults[cls].candidates.map(c => ({
        ...c.toObject(),
        percentage: total > 0 ? Math.round((c.voteCount / total) * 100) : 0,
      })).sort((a, b) => b.voteCount - a.voteCount);
    });

    res.json({
      success: true,
      data: {
        electionType: 'school',
        classWiseResults,
        schoolLeaders: withPercent(schoolLeaders, totalSchoolVotes),
        boothResults,
        classTurnout: classTurnout.sort((a, b) => a.class.localeCompare(b.class)),
        totalClassVotes,
        totalSchoolVotes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/results/live
router.get('/live', protect, async (req, res) => {
  try {
    const candidates = await Candidate.find({ active: true }).sort({ voteCount: -1 });
    res.json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
