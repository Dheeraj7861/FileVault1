const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['project_created', 'version_uploaded', 'version_approved', 
           'version_rejected', 'collaborator_added', 'collaborator_removed', 
           'access_requested', 'access_granted', 'access_denied', 'project_updated']
  },
  details: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for faster queries
activitySchema.index({ project: 1, createdAt: -1 });

// Static method to get recent activities for a project
activitySchema.statics.getProjectActivities = async function(projectId, limit = 50) {
  return this.find({ project: projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email profilePicture')
    .lean();
};

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity; 