const Notification = require('../models/notification.model');

// @desc    Get all notifications for current user
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get notifications for user, newest first
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .populate('fromUser', 'name email profilePicture')
      .populate('project', 'name')
      .limit(50);
    
    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false
    });
    
    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching notifications'
    });
  }
};

// @desc    Mark notification as read (now deletes the notification)
// @route   PUT /api/notifications/:notificationId
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;
    
    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Delete notification instead of marking as read
    await Notification.deleteOne({ _id: notificationId });
    
    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting notification'
    });
  }
};

// @desc    Mark all notifications as read (now deletes all notifications)
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Delete all notifications for the user
    const result = await Notification.deleteMany({ recipient: userId });
    
    return res.status(200).json({
      success: true,
      message: 'All notifications deleted',
      data: {
        count: result.deletedCount
      }
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting notifications'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};