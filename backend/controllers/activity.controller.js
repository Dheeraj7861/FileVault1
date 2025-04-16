const Activity = require('../models/activity.model');
const Project = require('../models/project.model');
const { checkProjectAccess } = require('../utils/accessControl');
const activityService = require('../services/activity.service');

/**
 * @desc Get the project timeline (activities)
 * @route GET /api/activities/timeline/:projectId
 * @access Private (project viewers, editors, creators)
 */
const getProjectTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Check user access
    const accessLevel = await checkProjectAccess(project, userId);
    if (!accessLevel) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this project' });
    }
    
    // Get timeline activities (limit to 20 most recent)
    const activities = await activityService.getProjectActivities(projectId, 20, 0);
    
    return res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error fetching project timeline:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch project timeline' });
  }
};

/**
 * @desc Get project activities with pagination
 * @route GET /api/activities/project/:projectId
 * @access Private (project viewers, editors, creators)
 */
const getProjectActivities = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { limit = 10, page = 1 } = req.query;
    
    // Convert to numbers and calculate skip
    const limitNum = parseInt(limit);
    const skip = (parseInt(page) - 1) * limitNum;
    
    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Check user access
    const accessLevel = await checkProjectAccess(project, userId);
    if (!accessLevel) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this project' });
    }
    
    // Get activities with pagination
    const activities = await activityService.getProjectActivities(projectId, limitNum, skip);
    
    // Get total count for pagination
    const totalCount = await Activity.countDocuments({ project: projectId });
    
    return res.json({
      success: true,
      activities,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching project activities:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch project activities' });
  }
};

module.exports = {
  getProjectTimeline,
  getProjectActivities
}; 