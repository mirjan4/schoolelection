const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
  },
  electionType: {
    type: String,
    required: true,
  },
  positionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    default: null,
  },
  boothId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booth',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Prevent duplicate votes: one student, one election type (School mode)
voteSchema.index(
  { studentId: 1, electionType: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      electionType: { $in: ['class_leader', 'school_leader'] } 
    } 
  }
);

// Prevent duplicate votes for same position candidate (College mode)
voteSchema.index(
  { studentId: 1, positionId: 1, candidateId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      positionId: { $exists: true, $ne: null } 
    } 
  }
);

// Fast performance indexes
voteSchema.index({ studentId: 1 });
voteSchema.index({ candidateId: 1 });
voteSchema.index({ positionId: 1 });
voteSchema.index({ boothId: 1 });
voteSchema.index({ studentId: 1, candidateId: 1 });
voteSchema.index({ studentId: 1, positionId: 1 });

module.exports = mongoose.model('Vote', voteSchema);
