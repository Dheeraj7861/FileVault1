const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentVersion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Version',
    default: null
  },
  versions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Version'
  }],
  accessibleBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    accessType: {
      type: String,
      enum: ['creator', 'editor', 'viewer'],
      default: 'viewer'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  accessRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    requestType: {
      type: String,
      enum: ['editor'],
      default: 'editor'
    },
    message: {
      type: String,
      default: 'No message provided'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }]
}, {
  timestamps: true
});

// Virtual field for total versions
projectSchema.virtual('versionCount').get(function() {
  return this.versions.length;
});

// Method to check if user has access to project
projectSchema.methods.hasAccess = function(userId, accessType) {
  const userAccess = this.accessibleBy.find(
    access => access.user.toString() === userId.toString()
  );
  
  if (!userAccess) return false;
  
  if (accessType === 'view') {
    return ['creator', 'editor', 'viewer'].includes(userAccess.accessType);
  } else if (accessType === 'edit') {
    return ['creator', 'editor'].includes(userAccess.accessType);
  } else if (accessType === 'admin') {
    return userAccess.accessType === 'creator';
  }
  
  return false;
};

// Middleware to add creator to accessibleBy
projectSchema.pre('save', function(next) {
  if (this.isNew) {
    // Check if creator is already in accessibleBy
    const creatorExists = this.accessibleBy.some(
      access => access.user && access.user.toString() === this.creator.toString()
    );
    
    // Only add creator if not already present
    if (!creatorExists) {
      this.accessibleBy.push({
        user: this.creator,
        accessType: 'creator',
        addedAt: Date.now()
      });
    }
  }
  next();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project; 