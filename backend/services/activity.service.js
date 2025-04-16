const Activity = require('../models/activity.model');
const { getProjectById, isUserProjectCollaborator } = require('./project.service');

/**
 * Log an activity for a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID
 * @param {string} action - The activity action
 * @param {string} details - Additional details about the activity
 * @param {Object} metadata - Optional metadata for the activity
 * @returns {Promise<Object>} The created activity
 */
const logActivity = async (projectId, userId, action, details = '', metadata = {}) => {
  try {
    const activity = new Activity({
      project: projectId,
      user: userId,
      action,
      details,
      metadata
    });
    
    return await activity.save();
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

/**
 * Get activities for a project with pagination
 * @param {string} projectId - The project ID
 * @param {number} limit - Number of activities to return (default: 50)
 * @param {number} skip - Number of activities to skip (default: 0)
 * @returns {Promise<Array>} List of activities
 */
const getProjectActivities = async (projectId, limit = 50, skip = 0) => {
  try {
    const activities = await Activity.find({ project: projectId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email profilePicture')
      .lean();
    
    return activities;
  } catch (error) {
    console.error('Error getting project activities:', error);
    throw error;
  }
};

module.exports = {
  logActivity,
  getProjectActivities,
  getProjectById,
  isUserProjectCollaborator
}; 