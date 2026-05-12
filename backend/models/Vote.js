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
    enum: ['class_leader', 'school_leader'],
    required: true,
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

// Prevent duplicate votes: one student, one election type
voteSchema.index({ studentId: 1, electionType: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
