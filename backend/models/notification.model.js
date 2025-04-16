const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'new_version',
      'version_approved',
      'version_rejected',
      'access_granted',
      'access_requested',
      'mention'
    ],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  version: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Version',
    required: false
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  read: {
    type: Boolean,
    default: false
  },
  link: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Static method to get unread notifications for a user
notificationSchema.statics.getUnreadNotifications = async function(userId) {
  return this.find({
    recipient: userId,
    read: false
  })
  .sort({ createdAt: -1 })
  .populate('fromUser', 'name profilePicture')
  .populate('project', 'name');
};

// Static method to mark all notifications as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, read: false },
    { read: true }
  );
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 