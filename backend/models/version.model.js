const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  key: {
    type: String,
    description: 'The S3 key for the file'
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Static method to get latest versions
versionSchema.statics.getLatestVersions = async function(projectId, limit = 15) {
  return this.find({ 
    project: projectId,
    status: 'approved'
  })
  .sort({ versionNumber: -1 })
  .limit(limit)
  .populate('uploadedBy', 'name email')
  .populate('approvedBy', 'name email');
};

// Static method to get pending versions
versionSchema.statics.getPendingVersions = async function(projectId) {
  return this.find({
    project: projectId,
    status: 'pending'
  })
  .sort({ createdAt: -1 })
  .populate('uploadedBy', 'name email');
};

const Version = mongoose.model('Version', versionSchema);

module.exports = Version; 