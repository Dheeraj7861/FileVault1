const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Notification routes
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:notificationId', markAsRead);

module.exports = router; 