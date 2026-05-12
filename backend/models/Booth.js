const mongoose = require('mongoose');

const boothSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Booth name is required'],
    trim: true,
  },
  code: {
    type: String,
    required: [true, 'Booth code is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
    default: '',
  },
  active: {
    type: Boolean,
    default: true,
  },
  minVoters: {
    type: Number,
    default: 10,
  },
  maxVoters: {
    type: Number,
    default: 100,
  },
  deviceToken: {
    type: String,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Booth', boothSchema);
