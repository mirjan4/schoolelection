const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  boothId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booth',
    required: true,
    unique: true,
  },
  currentStudent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    default: null,
  },
  status: {
    type: String,
    enum: ['idle', 'waiting', 'voting', 'completed'],
    default: 'idle',
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
