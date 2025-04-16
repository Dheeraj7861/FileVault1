const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getCurrentUser, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:resetToken', resetPassword);

// Add a simple token verification endpoint
router.get('/verify-token', protect, (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

// Private routes
router.get('/me', protect, getCurrentUser);

module.exports = router; 