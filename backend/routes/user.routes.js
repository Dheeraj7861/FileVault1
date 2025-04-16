const express = require('express');
const router = express.Router();
const {
  searchUsers,
  updateProfile,
  changePassword
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// User routes
router.get('/search', searchUsers);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

module.exports = router; 