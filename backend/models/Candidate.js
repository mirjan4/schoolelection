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
  symbolType: {
    type: String,
    enum: ['icon', 'image'],
    default: 'icon',
  },
  symbolImage: {
    type: String,
    default: '',
  },
  electionType: {
    type: String,
    enum: ['class_leader', 'school_leader', 'college_position'],
    required: [true, 'Election type is required'],
  },
  positionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Position',
    default: null,
  },
  department: {
    type: String,
    default: '',
  },
  year: {
    type: String,
    default: '',
  },
  class: {
    type: String,
    default: '',
  },
  manifesto: {
    type: String,
    default: '',
    trim: true,
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
