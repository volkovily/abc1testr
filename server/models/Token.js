const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  platform: {
    type: String,
    required: true,
    enum: ['youtube', 'tiktok', 'facebook', 'twitter'],
    index: true,
  },
  
  accessToken: {
    type: String,
    required: true,
  },
  
  refreshToken: {
    type: String,
    required: true,
  },
  
  expiryTime: {
    type: Number,
    required: true,
  },
  
  platformUserId: {
    type: String,
    sparse: true,
  },
  
  platformUserName: {
    type: String,
  },
  
  platformUserData: {
    type: Object,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

tokenSchema.index({ userId: 1, platform: 1 }, { unique: true });

tokenSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;