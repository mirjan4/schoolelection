const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Position name is required'],
    trim: true,
  },
  maxVotes: {
    type: Number,
    default: 1,
    required: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Position', positionSchema);
