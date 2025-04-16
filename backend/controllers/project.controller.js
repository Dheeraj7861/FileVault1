const Project = require('../models/project.model');
const User = require('../models/user.model');
// Uncomment the notification service import
const { notifyAccessChange, notifyAccessRequest } = require('../services/notification.service');
// Import activity service for logging activities
const activityService = require('../services/activity.service');
// const { io } = require('../server');

// Add new function to ensure all projects are visible to all users
const makeAllProjectsAccessible = async () => {
  try {
    // Get all users and projects
    const allUsers = await User.find({});
    const allProjects = await Project.find({});
    
    console.log(`Found ${allUsers.length} users and ${allProjects.length} projects`);
    
    // For each project, ensure all users have at least viewer access
    for (const project of allProjects) {
      let updated = false;
      
      // Check each user
      for (const user of allUsers) {
        // Skip if this is the project creator (they should already have creator access)
        if (project.creator.toString() === user._id.toString()) {
          continue;
        }
        
        // Check if user already has access
        const hasAccess = project.accessibleBy.some(
          access => access.user && access.user.toString() === user._id.toString()
        );
        
        // If user doesn't have access, add them as a viewer
        if (!hasAccess) {
          project.accessibleBy.push({
            user: user._id,
            accessType: 'viewer',
            addedAt: Date.now()
          });
          updated = true;
          console.log(`Added user ${user.email} as viewer to project ${project.name}`);
        }
      }
      
      // Save project if it was updated
      if (updated) {
        await project.save();
        console.log(`Updated project ${project.name}`);
      }
    }
    
    console.log('All projects have been made accessible to all users');
  } catch (error) {
    console.error('Error making projects accessible:', error);
  }
};

// @desc    Get all projects for user
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fix all projects visibility (temporary solution)
    await makeAllProjectsAccessible();
    
    // Find projects where user has any access
    const projects = await Project.find({
      'accessibleBy.user': userId
    })
    .populate('creator', 'name email profilePicture')
    .populate('currentVersion');
    
    console.log(`Found ${projects.length} projects for user ${userId}`);
    
    // Organize projects by access level
    const ownedProjects = projects.filter(
      p => p.accessibleBy.find(
        access => access.user.toString() === userId.toString() && access.accessType === 'creator'
      )
    );
    
    const editableProjects = projects.filter(
      p => p.accessibleBy.find(
        access => access.user.toString() === userId.toString() && access.accessType === 'editor'
      )
    );
    
    const viewableProjects = projects.filter(
      p => p.accessibleBy.find(
        access => access.user.toString() === userId.toString() && access.accessType === 'viewer'
      )
    );
    
    // Add accessLevel to project objects for the frontend
    const projectsWithAccessLevel = projects.map(project => {
      const p = project.toObject();
      const userAccess = project.accessibleBy.find(
        access => access.user.toString() === userId.toString()
      );
      
      if (userAccess) {
        p.accessLevel = userAccess.accessType;
      }
      
      return p;
    });
    
    return res.status(200).json({
      success: true,
      data: {
        all: projectsWithAccessLevel,
        owned: ownedProjects.map(p => ({
          ...p.toObject(),
          accessLevel: 'creator'
        })),
        editable: editableProjects.map(p => ({
          ...p.toObject(),
          accessLevel: 'editor'
        })),
        viewable: viewableProjects.map(p => ({
          ...p.toObject(),
          accessLevel: 'viewer'
        }))
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching projects'
    });
  }
};

// @desc    Create new project
// @route   POST /api/projects
// @access  Private
const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user._id;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }
    
    // Create project with user as creator
    const project = await Project.create({
      name,
      description,
      creator: userId,
      // Don't set accessibleBy here, we'll set it after creating the project
    });

    // Add creator as creator explicitly first
    project.accessibleBy.push({
      user: userId,
      accessType: 'creator',
      addedAt: Date.now()
    });

    // Find all users except the creator
    // Important: We need to use a find query that will work reliably
    const allUsers = await User.find({
      _id: { $ne: userId }
    });
    
    console.log(`Found ${allUsers.length} other users to add as viewers to project ${project._id}`);
    
    // Add all users as viewers
    if (allUsers.length > 0) {
      const userAccessUpdates = allUsers.map(user => ({
        user: user._id,
        accessType: 'viewer',
        addedAt: Date.now()
      }));
      
      // Add all users to accessibleBy array
      project.accessibleBy.push(...userAccessUpdates);
    }
    
    // Save the project with all users added
    await project.save();
    
    // Log project creation activity
    await activityService.logActivity(project._id.toString(), userId.toString(), 'project_created', `Project ${name} created`);
    
    return res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating project'
    });
  }
};

// @desc    Get project by ID
// @route   GET /api/projects/:projectId
// @access  Private (with access check)
const getProject = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // If the project is already loaded by middleware, use it
    if (req.project) {
      console.log('[PROJECT] Using project from middleware');
      const project = req.project;
      
      // Populate needed fields
      await Project.populate(project, [
        { path: 'creator', select: 'name email profilePicture' },
        { path: 'accessibleBy.user', select: 'name email profilePicture' },
        { path: 'currentVersion' }
      ]);
      
      // Get user's access level
      const userAccess = project.accessibleBy.find(
        access => access.user._id.toString() === userId.toString()
      );
      
      return res.status(200).json({
        success: true,
        data: project,
        accessLevel: userAccess ? userAccess.accessType : null
      });
    }
    
    // If not available in middleware, load it (fallback)
    const { projectId } = req.params;
    console.log('[PROJECT] Loading project directly:', projectId);
    
    // Project is already loaded and checked for access in middleware
    const project = await Project.findById(projectId)
      .populate('creator', 'name email profilePicture')
      .populate('accessibleBy.user', 'name email profilePicture')
      .populate('currentVersion');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user has access - only needed if not using middleware
    if (!project.hasAccess(userId, 'view')) {
      console.log('[PROJECT] Access denied for user', userId, 'to project', projectId);
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this project'
      });
    }
    
    // Get user's access level
    const userAccess = project.accessibleBy.find(
      access => access.user._id.toString() === userId.toString()
    );
    
    return res.status(200).json({
      success: true,
      data: project,
      accessLevel: userAccess ? userAccess.accessType : null
    });
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching project'
    });
  }
};

// @desc    Update project
// @route   PUT /api/projects/:projectId
// @access  Private (creator or editor)
const updateProject = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, description } = req.body;
    
    // If the project is already loaded by middleware, use it
    if (req.project) {
      console.log('[PROJECT] Using project from middleware for update');
      const project = req.project;
      
      // Update project
      if (name) project.name = name;
      if (description !== undefined) project.description = description;
      
      await project.save();
      
      // Log project update activity
      await activityService.logActivity(project._id.toString(), userId.toString(), 'project_updated', `Project details updated: ${Object.keys({ name, description }).join(', ')}`);
      
      return res.status(200).json({
        success: true,
        data: project
      });
    }
    
    // Fallback - load project directly
    const { projectId } = req.params;
    console.log('[PROJECT] Loading project directly for update:', projectId);
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user has edit access - only needed if not using middleware
    if (!project.hasAccess(userId, 'edit')) {
      console.log('[PROJECT] Edit access denied for user', userId, 'to project', projectId);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this project'
      });
    }
    
    // Update project
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    
    await project.save();
    
    // Log project update activity
    await activityService.logActivity(projectId, userId.toString(), 'project_updated', `Project details updated: ${Object.keys({ name, description }).join(', ')}`);
    
    return res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating project'
    });
  }
};

// @desc    Delete project
// @route   DELETE /api/projects/:projectId
// @access  Private (creator only)
const deleteProject = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Only creator can delete project
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can delete this project'
      });
    }
    
    // Delete the project
    await Project.findByIdAndDelete(projectId);
    
    // In a real app, also delete all versions, files, etc.
    // This would include S3 cleanup
    
    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting project'
    });
  }
};

// @desc    Add user to project
// @route   POST /api/projects/:projectId/users
// @access  Private (creator only)
const addUserToProject = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const { email, accessType } = req.body;
    
    if (!email || !accessType) {
      return res.status(400).json({
        success: false,
        message: 'Email and access type are required'
      });
    }
    
    // Validate access type
    if (!['editor', 'viewer'].includes(accessType)) {
      return res.status(400).json({
        success: false,
        message: 'Access type must be editor or viewer'
      });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Only creator can add users
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can add users'
      });
    }
    
    // Find user by email
    const userToAdd = await User.findOne({ email });
    
    if (!userToAdd) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user already has access
    const existingAccess = project.accessibleBy.find(
      access => access.user.toString() === userToAdd._id.toString()
    );
    
    if (existingAccess) {
      // Update access if it already exists
      existingAccess.accessType = accessType;
      existingAccess.addedAt = Date.now();
    } else {
      // Add new access
      project.accessibleBy.push({
        user: userToAdd._id,
        accessType,
        addedAt: Date.now()
      });
    }
    
    // Save project
    await project.save();
    
    // Log activity
    await activityService.logActivity(project._id.toString(), userId.toString(), 'collaborator_added', 
      `Added ${userToAdd.name || userToAdd.email} as ${accessType}`, {
      targetUser: {
        id: userToAdd._id.toString(),
        name: userToAdd.name,
        email: userToAdd.email
      },
      accessType
    });

    // Notify user if this isn't a new user
    if (!existingAccess && userId.toString() !== userToAdd._id.toString()) {
      await notifyAccessChange(userToAdd._id, project, accessType);
    }
    
    return res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Add user to project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding user to project'
    });
  }
};

// @desc    Remove user from project
// @route   DELETE /api/projects/:projectId/users/:userId
// @access  Private (creator only)
const removeUserFromProject = async (req, res) => {
  try {
    const creatorId = req.user._id;
    const { projectId, userId: userIdToRemove } = req.params;
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Only creator can remove users
    if (project.creator.toString() !== creatorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can remove users'
      });
    }
    
    // Creator cannot remove themselves
    if (userIdToRemove === project.creator.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove project creator'
      });
    }
    
    // Remove user from accessibleBy
    project.accessibleBy = project.accessibleBy.filter(
      access => access.user.toString() !== userIdToRemove
    );
    
    // Save project
    await project.save();
    
    // Get user info from User model for activity logging
    const removedUser = await User.findById(userIdToRemove);
    
    // Log activity
    await activityService.logActivity(projectId, creatorId.toString(), 'collaborator_removed', 
      `Removed ${removedUser ? removedUser.name : 'a user'} from project`, {
      targetUser: {
        id: userIdToRemove.toString(),
        name: removedUser ? removedUser.name : 'Unknown',
        email: removedUser ? removedUser.email : 'Unknown'
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'User removed from project',
      data: project
    });
  } catch (error) {
    console.error('Remove user from project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error removing user from project'
    });
  }
};

// @desc    Request access to project
// @route   POST /api/projects/:projectId/request-access
// @access  Private
const requestAccess = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const { message, requestType = 'editor' } = req.body;
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user already has access
    const existingAccess = project.accessibleBy.find(
      access => access.user.toString() === userId.toString()
    );
    
    // If user has creator or editor access, they don't need to request it
    if (existingAccess && ['creator', 'editor'].includes(existingAccess.accessType)) {
      return res.status(400).json({
        success: false,
        message: 'You already have editor access to this project'
      });
    }
    
    // Check if user already has a pending request
    const existingRequest = project.accessRequests?.find(
      request => request.user.toString() === userId.toString() && request.status === 'pending'
    );
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending access request'
      });
    }
    
    // Add request to project
    project.accessRequests.push({
      user: userId,
      requestType,
      message: message || 'No message provided',
      requestedAt: Date.now(),
      status: 'pending'
    });
    
    await project.save();
    
    // Send notification to project creator
    await notifyAccessRequest(project, req.user, message);
    
    // Log activity
    await activityService.logActivity(projectId, userId.toString(), 'access_requested', 
      `Requested ${requestType} access`, {
      message,
      requestType
    });
    
    return res.status(200).json({
      success: true,
      message: 'Access request sent to project creator'
    });
  } catch (error) {
    console.error('Request access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error sending access request'
    });
  }
};

// @desc    Generate shareable link for project
// @route   POST /api/projects/:projectId/share
// @access  Private (with access check)
const generateShareLink = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    const { expiration = 7 } = req.body; // Default 7 days
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user has access to share
    if (!project.hasAccess(userId, 'view')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to share this project'
      });
    }
    
    // Generate a JWT token for sharing
    const jwt = require('jsonwebtoken');
    const shareToken = jwt.sign(
      { 
        projectId,
        sharedBy: userId,
        type: 'project-share'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: `${expiration}d` }
    );
    
    const shareUrl = `${process.env.CLIENT_URL}/shared/project/${shareToken}`;
    
    return res.status(200).json({
      success: true,
      data: {
        shareUrl,
        expiresIn: `${expiration} days`
      }
    });
  } catch (error) {
    console.error('Generate share link error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating share link'
    });
  }
};

// @desc    Get access requests for a project
// @route   GET /api/projects/:projectId/access-requests
// @access  Private (creator only)
const getAccessRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId)
      .populate('accessRequests.user', 'name email profilePicture');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is the project creator
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can view access requests'
      });
    }
    
    // Get pending requests
    const pendingRequests = project.accessRequests.filter(
      request => request.status === 'pending'
    );
    
    return res.status(200).json({
      success: true,
      data: pendingRequests
    });
  } catch (error) {
    console.error('Get access requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error getting access requests'
    });
  }
};

// @desc    Handle access request (approve/reject)
// @route   PUT /api/projects/:projectId/access-requests/:requestId
// @access  Private (creator only)
const handleAccessRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { projectId, requestId } = req.params;
    const { status, accessType } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      });
    }
    
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Check if user is the project creator
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can handle access requests'
      });
    }
    
    // Find the request
    const requestIndex = project.accessRequests.findIndex(
      request => request._id.toString() === requestId
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Access request not found'
      });
    }
    
    const request = project.accessRequests[requestIndex];
    
    // Update request status
    project.accessRequests[requestIndex].status = status;
    
    // If approved, update user's access level
    if (status === 'approved') {
      // Check if user already has access to the project
      const accessIndex = project.accessibleBy.findIndex(
        access => access.user.toString() === request.user.toString()
      );
      
      if (accessIndex !== -1) {
        // Update existing access
        project.accessibleBy[accessIndex].accessType = accessType || request.requestType;
      } else {
        // Add new access
        project.accessibleBy.push({
          user: request.user,
          accessType: accessType || request.requestType,
          addedAt: Date.now()
        });
      }
      
      // Send notification to the requester
      await notifyAccessChange(
        request.user,
        projectId,
        accessType || request.requestType,
        userId
      );
    }
    
    // Save the project
    await project.save();
    
    // Log activity for approving access
    await activityService.logActivity(projectId, userId.toString(), 'access_granted', 
      `Granted ${accessType} access to ${request.user.name}`, {
      targetUser: {
        id: request.user._id.toString(),
        name: request.user.name,
        email: request.user.email
      },
      accessType
    });
    
    return res.status(200).json({
      success: true,
      message: `Access request ${status === 'approved' ? 'approved' : 'rejected'}`
    });
  } catch (error) {
    console.error('Handle access request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error handling access request'
    });
  }
};

module.exports = {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  addUserToProject,
  removeUserFromProject,
  requestAccess,
  generateShareLink,
  getAccessRequests,
  handleAccessRequest
};