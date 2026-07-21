const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'School Election',
  },
  type: {
    type: String,
    enum: ['school', 'college'],
    default: 'school',
  },
  status: {
    type: String,
    enum: ['not_started', 'active', 'paused', 'ended'],
    default: 'not_started',
  },
  startedAt: {
    type: Date,
    default: null,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  scheduledEnd: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

module.exports = mongoose.model('Election', electionSchema);
