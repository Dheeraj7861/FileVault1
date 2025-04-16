// Notification functionality commented out for now - will implement later
const Notification = require('../models/notification.model');
const { io } = require('../server');

// Placeholder notification service
// Real implementation commented out for later

// Create and send a notification
const createNotification = async (data) => {
  try {
    // Create notification in database
    const notification = new Notification({
      recipient: data.recipient,
      type: data.type,
      message: data.message,
      project: data.project,
      version: data.version,
      fromUser: data.fromUser,
      link: data.link
    });
    
    await notification.save();
    
    // Populate the notification with related data
    const populatedNotification = await Notification.findById(notification._id)
      .populate('fromUser', 'name email profilePicture')
      .populate('project', 'name');
    
    // Send real-time notification via Socket.io
    if (io) {
      io.to(`user:${data.recipient}`).emit('notification', {
        notification: populatedNotification
      });
    } else {
      console.log('Socket.io not initialized, notification not sent in real-time');
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send notification for new version upload
const notifyNewVersion = async (version, project) => {
  try {
    // Get project creator
    const creatorId = project.creator;
    
    // Don't notify if uploader is the creator
    if (version.uploadedBy && version.uploadedBy.toString() === creatorId.toString()) {
      return;
    }
    
    // Create notification for project creator
    await createNotification({
      recipient: creatorId,
      type: 'new_version',
      message: `A new version has been uploaded to project ${project.name} and awaits your approval`,
      project: project._id,
      version: version._id,
      fromUser: version.uploadedBy || version.createdBy,
      link: `/project/${project._id}/versions`
    });
  } catch (error) {
    console.error('Error sending new version notification:', error);
  }
};

// Notify user of version approval/rejection
const notifyVersionStatus = async (version, status, project) => {
  try {
    const uploaderId = version.uploadedBy || version.createdBy;
    const approverId = version.approvedBy || project.creator;
    
    // Don't notify if uploader is the same as approver
    if (uploaderId.toString() === approverId.toString()) {
      return;
    }
    
    // Create notification for version uploader
    await createNotification({
      recipient: uploaderId,
      type: status === 'approved' ? 'version_approved' : 'version_rejected',
      message: `Your version upload for project ${project.name} has been ${status}`,
      project: project._id,
      version: version._id,
      fromUser: approverId,
      link: `/project/${project._id}/versions`
    });
  } catch (error) {
    console.error(`Error sending version ${status} notification:`, error);
  }
};

// Notify user of access change
const notifyAccessChange = async (userId, projectId, accessType, grantedBy) => {
  try {
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    await createNotification({
      recipient: userId,
      type: 'access_granted',
      message: `You have been granted ${accessType} access to project ${project.name}`,
      project: projectId,
      fromUser: grantedBy,
      link: `/project/${projectId}`
    });
  } catch (error) {
    console.error('Error sending access change notification:', error);
  }
};

// Notify about access request
const notifyAccessRequest = async (projectId, requesterId, message) => {
  try {
    const Project = require('../models/project.model');
    const User = require('../models/user.model');
    
    const [project, requester] = await Promise.all([
      Project.findById(projectId),
      User.findById(requesterId)
    ]);
    
    if (!project || !requester) {
      throw new Error('Project or user not found');
    }
    
    // Notify project creator
    await createNotification({
      recipient: project.creator,
      type: 'access_requested',
      message: `${requester.name} has requested access to your project ${project.name}`,
      project: projectId,
      fromUser: requesterId,
      link: `/project/${projectId}/settings`
    });
  } catch (error) {
    console.error('Error sending access request notification:', error);
  }
};

module.exports = {
  createNotification,
  notifyNewVersion,
  notifyVersionStatus,
  notifyAccessChange,
  notifyAccessRequest
};

/* 
// ORIGINAL IMPLEMENTATION - COMMENTED OUT FOR LATER USE
const Notification = require('../models/notification.model');
const { io } = require('../server');

// Create and send a notification
const createNotification = async (data) => {
  try {
    // Create notification in database
    const notification = new Notification({
      recipient: data.recipient,
      type: data.type,
      message: data.message,
      project: data.project,
      version: data.version,
      fromUser: data.fromUser,
      link: data.link
    });
    
    await notification.save();
    
    // Populate the notification with related data
    const populatedNotification = await Notification.findById(notification._id)
      .populate('fromUser', 'name email profilePicture')
      .populate('project', 'name');
    
    // Send real-time notification via Socket.io
    io.to(`user:${data.recipient}`).emit('notification', {
      notification: populatedNotification
    });
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Send notification for new version upload
const notifyNewVersion = async (version, project) => {
  try {
    // Get project creator
    const creatorId = project.creator;
    
    // Don't notify if uploader is the creator
    if (version.uploadedBy.toString() === creatorId.toString()) {
      return;
    }
    
    // Create notification for project creator
    await createNotification({
      recipient: creatorId,
      type: 'new_version',
      message: `A new version has been uploaded to project ${project.name} and awaits your approval`,
      project: project._id,
      version: version._id,
      fromUser: version.uploadedBy,
      link: `/project/${project._id}/versions`
    });
  } catch (error) {
    console.error('Error sending new version notification:', error);
  }
};

// Notify user of version approval/rejection
const notifyVersionStatus = async (version, status, project) => {
  try {
    // Don't notify if uploader is the same as approver
    if (version.uploadedBy.toString() === version.approvedBy.toString()) {
      return;
    }
    
    // Create notification for version uploader
    await createNotification({
      recipient: version.uploadedBy,
      type: status === 'approved' ? 'version_approved' : 'version_rejected',
      message: `Your version upload for project ${project.name} has been ${status}`,
      project: project._id,
      version: version._id,
      fromUser: version.approvedBy,
      link: `/project/${project._id}/versions`
    });
  } catch (error) {
    console.error(`Error sending version ${status} notification:`, error);
  }
};

// Notify user of access change
const notifyAccessChange = async (userId, projectId, accessType, grantedBy) => {
  try {
    const Project = require('../models/project.model');
    const project = await Project.findById(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    await createNotification({
      recipient: userId,
      type: 'access_granted',
      message: `You have been granted ${accessType} access to project ${project.name}`,
      project: projectId,
      fromUser: grantedBy,
      link: `/project/${projectId}`
    });
  } catch (error) {
    console.error('Error sending access change notification:', error);
  }
};

// Notify about access request
const notifyAccessRequest = async (projectId, requesterId, message) => {
  try {
    const Project = require('../models/project.model');
    const User = require('../models/user.model');
    
    const [project, requester] = await Promise.all([
      Project.findById(projectId),
      User.findById(requesterId)
    ]);
    
    if (!project || !requester) {
      throw new Error('Project or user not found');
    }
    
    // Notify project creator
    await createNotification({
      recipient: project.creator,
      type: 'access_requested',
      message: `${requester.name} has requested access to your project ${project.name}`,
      project: projectId,
      fromUser: requesterId,
      link: `/project/${projectId}/settings`
    });
  } catch (error) {
    console.error('Error sending access request notification:', error);
  }
};
*/ 