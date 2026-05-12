const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true,
  },
  photo: {
    type: String,
    default: '',
  },
  symbol: {
    type: String,
    default: '',
  },
  symbolIcon: {
    type: String,
    default: '⭐',
  },
  electionType: {
    type: String,
    enum: ['class_leader', 'school_leader'],
    required: [true, 'Election type is required'],
  },
  class: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  voteCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('Candidate', candidateSchema);
