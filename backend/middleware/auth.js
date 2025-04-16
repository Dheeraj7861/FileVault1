const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/user.model');
const mongoose = require('mongoose');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token for Socket.io
const verifySocketToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { id: decoded.id, email: decoded.email };
  } catch (error) {
    return null;
  }
};

// Protected route middleware
const protect = passport.authenticate('jwt', { session: false });

// Role-based access control middleware
const authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Add logic here if you need role-based authorization

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Server error in authorization'
      });
    }
  };
};

// Middleware to check project access
const checkProjectAccess = (accessLevel) => {
  return async (req, res, next) => {
    const { projectId } = req.params;
    const userId = req.user._id;
    
    console.log(`[ACCESS] Checking ${accessLevel} access for user ${userId} to project ${projectId}`);
    
    try {
      const Project = require('../models/project.model');
      
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        console.log(`[ACCESS] Invalid project ID format: ${projectId}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid project ID format'
        });
      }
      
      const project = await Project.findById(projectId);
      
      if (!project) {
        console.log(`[ACCESS] Project not found: ${projectId}`);
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }
      
      console.log(`[ACCESS] Project found: ${project.name} (${project._id})`);
      console.log(`[ACCESS] Creator: ${project.creator}`);
      console.log(`[ACCESS] Accessible by: ${JSON.stringify(project.accessibleBy.map(a => ({
        user: a.user.toString(),
        type: a.accessType
      })))}`);
      
      // Check if user has required access level
      const hasAccess = project.hasAccess(userId, accessLevel);
      console.log(`[ACCESS] User ${userId} has ${accessLevel} access: ${hasAccess}`);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `You don't have ${accessLevel} permission for this project`
        });
      }
      
      // Add project to request
      req.project = project;
      next();
    } catch (error) {
      console.error('[ACCESS-ERROR] Server error while checking project access:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error while checking project access',
        error: error.message
      });
    }
  };
};

module.exports = {
  generateToken,
  protect,
  authorize,
  verifySocketToken,
  checkProjectAccess
}; 