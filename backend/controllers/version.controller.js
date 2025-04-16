const Project = require('../models/project.model');
const Version = require('../models/version.model');
const User = require('../models/user.model');
const { getSignedUploadUrl, getSignedDownloadUrl, deleteFile } = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const s3Config = require('../config/s3');
const s3 = s3Config.s3;
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'project-nexus-files';
// Import notification service
const { notifyNewVersion, notifyVersionStatus } = require('../services/notification.service');
// Import activity service for logging activities
const activityService = require('../services/activity.service');

// @desc    Get all versions for a project
// @route   GET /api/projects/:projectId/versions
// @access  Private (with access check)
const getVersions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;
    
    // Project is loaded in middleware
    const project = req.project;
    
    // Get approved versions (limited to 15)
    const approvedVersions = await Version.getLatestVersions(projectId, 15);
    
    // If user is project creator, also get pending versions
    let pendingVersions = [];
    if (project.creator.toString() === userId.toString()) {
      pendingVersions = await Version.getPendingVersions(projectId);
    }
    
    // Log what we're returning
    console.log(`Returning ${approvedVersions.length} approved versions and ${pendingVersions.length} pending versions`);
    
    // Ensure each version has a direct file URL and map creator name
    [...approvedVersions, ...pendingVersions].forEach(version => {
      // If the version has a key, create a direct S3 URL
      if (version.key) {
        version.fileUrl = `https://${bucketName}.s3.amazonaws.com/${version.key}`;
        console.log(`Version ${version._id}: Using direct S3 URL from key`);
      } else {
        // Keep the existing URL
        console.log(`Version ${version._id}: Using original fileUrl`);
      }
      
      // Make sure creator name is available to frontend
      if (version.uploadedBy && typeof version.uploadedBy === 'object') {
        version.creatorName = version.uploadedBy.name || 'Unknown User';
      } else {
        version.creatorName = 'Unknown User';
      }
    });
    
    return res.status(200).json({
      success: true,
      data: {
        approved: approvedVersions,
        pending: pendingVersions
      }
    });
  } catch (error) {
    console.error('Get versions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching versions'
    });
  }
};

// @desc    Get signed URL for file upload
// @route   GET /api/projects/:projectId/versions/upload-url
// @access  Private (editor or creator)
const getUploadUrl = async (req, res) => {
  try {
    const { fileName, fileType } = req.query;
    
    if (!fileName || !fileType) {
      return res.status(400).json({
        success: false,
        message: 'File name and type are required'
      });
    }
    
    // Get signed URL from S3
    const uploadData = await getSignedUploadUrl(fileType, fileName);
    
    return res.status(200).json({
      success: true,
      data: uploadData
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error generating upload URL'
    });
  }
};

// @desc    Upload file directly to S3 via server (bypassing CORS)
// @route   POST /api/projects/:projectId/versions/upload-file
// @access  Private (editor or creator)
const uploadFile = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const file = req.files.file;
    const fileType = file.mimetype;
    const fileName = file.name;
    const { projectId } = req.params;
    
    console.log(`Attempting to upload file: ${fileName}, type: ${fileType}, size: ${file.size} bytes`);
    
    // Get the next version number
    const lastVersion = await Version.findOne({ project: projectId })
      .sort({ versionNumber: -1 });
    
    const versionNumber = lastVersion ? lastVersion.versionNumber + 1 : 1;
    
    // Get a key for the file
    const fileExtension = fileName.split('.').pop();
    // Organize by project/version structure
    const key = `projects/${projectId}/versions/v${versionNumber}-${uuidv4()}.${fileExtension}`;
    
    // Upload to S3 directly from server
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: file.data,
      ContentType: fileType
    };
    
    console.log(`S3 upload parameters: Bucket=${bucketName}, Key=${key}, ContentType=${fileType}`);
    
    try {
      const uploadResult = await s3.upload(params).promise();
      console.log('S3 upload successful! Full details:');
      console.log('- Location:', uploadResult.Location);
      console.log('- Key:', key);
      console.log('- Bucket:', bucketName);
      console.log('- ETag:', uploadResult.ETag);
      
      // Make sure we're using the direct S3 URL from S3
      const fileUrl = uploadResult.Location || `https://${bucketName}.s3.amazonaws.com/${key}`;
      console.log('Final fileUrl to be stored:', fileUrl);
      
      // Return the file info
      return res.status(200).json({
        success: true,
        data: {
          key,
          fileUrl,
          fileName,
          fileType,
          fileSize: file.size,
          versionNumber
        }
      });
    } catch (s3Error) {
      console.error('S3 Upload error details:', s3Error);
      return res.status(500).json({
        success: false,
        message: `S3 upload failed: ${s3Error.message}`,
        error: s3Error.code
      });
    }
  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error uploading file'
    });
  }
};

// @desc    Create a new version
// @route   POST /api/projects/:projectId/versions
// @access  Private (editor or creator)
const createVersion = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;
    const { 
      fileUrl, 
      fileName, 
      fileSize, 
      fileType, 
      notes, 
      key,
      versionNumber: clientVersionNumber 
    } = req.body;
    
    if (!fileUrl || !fileName) {
      return res.status(400).json({
        success: false,
        message: 'File URL and name are required'
      });
    }
    
    // Project is loaded in middleware
    const project = req.project;
    
    // Get the next version number
    const lastVersion = await Version.findOne({ project: projectId })
      .sort({ versionNumber: -1 });
    
    // Use provided version number from client or calculate new one
    const versionNumber = clientVersionNumber || (lastVersion ? lastVersion.versionNumber + 1 : 1);
    
    console.log(`Creating version ${versionNumber} for project ${projectId}`, {
      fileName,
      fileUrl: fileUrl.substring(0, 100) + '...',
      key: key || 'Not provided',
      fileSize
    });
    
    // Set status based on who uploaded it
    let status = 'pending';
    let approvedBy = null;
    let approvedAt = null;
    
    // If creator is uploading, auto-approve
    if (project.creator.toString() === userId.toString()) {
      status = 'approved';
      approvedBy = userId;
      approvedAt = new Date();
    }
    
    // Create version
    const version = await Version.create({
      project: projectId,
      versionNumber,
      fileUrl,
      key, // Store the S3 key
      fileName,
      fileSize: fileSize || 0,
      fileType: fileType || 'application/octet-stream',
      uploadedBy: userId,
      status,
      notes: notes || '',
      approvedBy,
      approvedAt
    });
    
    console.log(`Version ${version._id} created successfully with status: ${status}`);
    
    // If auto-approved, update project's current version
    if (status === 'approved') {
      project.currentVersion = version._id;
      
      // Add to versions array if not already there
      if (!project.versions.includes(version._id)) {
        project.versions.push(version._id);
      }
      
      await project.save();
      console.log(`Project ${projectId} updated with new current version ${version._id}`);
    } else {
      // Send notification to project creator
      await notifyNewVersion(version, project);
      console.log(`Pending version created, waiting for approval`);
    }
    
    // Log activity - Fixed parameter order
    await activityService.logActivity(projectId, userId, 'version_uploaded', `Version ${versionNumber} uploaded`, {
      versionNumber, 
      fileName
    });
    
    return res.status(201).json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('Create version error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating version'
    });
  }
};

// @desc    Get version by ID
// @route   GET /api/projects/:projectId/versions/:versionId
// @access  Private (with access check)
const getVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    
    console.log(`Getting version details for projectId=${projectId}, versionId=${versionId}`);
    
    const version = await Version.findOne({
      _id: versionId,
      project: projectId
    })
    .populate('uploadedBy', 'name email profilePicture')
    .populate('approvedBy', 'name email profilePicture');
    
    if (!version) {
      console.log(`Version not found: projectId=${projectId}, versionId=${versionId}`);
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }
    
    console.log(`Version found:`, {
      id: version._id,
      fileName: version.fileName,
      key: version.key || 'Not stored',
      versionNumber: version.versionNumber
    });
    
    // Handle file access
    let fileUrl = version.fileUrl;
    
    // If we have the S3 key stored, create a direct URL
    if (version.key) {
      fileUrl = `https://${bucketName}.s3.amazonaws.com/${version.key}`;
      console.log(`Created direct S3 URL from key: ${fileUrl}`);
    } else {
      console.log(`Using original fileUrl: ${fileUrl}`);
    }
    
    // Return the version with updated URL
    const versionData = version.toObject();
    versionData.fileUrl = fileUrl;
    
    // Make sure creator name is available to frontend
    if (versionData.uploadedBy && typeof versionData.uploadedBy === 'object') {
      versionData.creatorName = versionData.uploadedBy.name || 'Unknown User';
    } else {
      versionData.creatorName = 'Unknown User';
    }
    
    // Log activity
    await activityService.logActivity(projectId, userId, 'version_viewed', `Viewed version ${version.versionNumber}`, {
      versionNumber: version.versionNumber
    });
    
    return res.status(200).json({
      success: true,
      data: versionData
    });
  } catch (error) {
    console.error('Get version error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching version'
    });
  }
};

// @desc    Approve or reject version
// @route   PUT /api/projects/:projectId/versions/:versionId/status
// @access  Private (creator only)
const updateVersionStatus = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    const userId = req.user._id;
    const { status, notes } = req.body;
    
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (approved/rejected) is required'
      });
    }
    
    // Project is loaded in middleware
    const project = req.project;
    
    // Only creator can approve/reject
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can approve or reject versions'
      });
    }
    
    const version = await Version.findOne({
      _id: versionId,
      project: projectId,
      status: 'pending'
    });
    
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Pending version not found'
      });
    }
    
    // Update version status
    version.status = status;
    version.approvedBy = userId;
    version.approvedAt = new Date();
    
    if (notes) {
      version.notes = notes;
    }
    
    await version.save();
    
    // If approved, update project's current version
    if (status === 'approved') {
      project.currentVersion = version._id;
      
      // Add to versions array if not already there
      if (!project.versions.includes(version._id)) {
        project.versions.push(version._id);
      }
      
      await project.save();
    } else if (status === 'rejected') {
      // Delete the file from S3 when version is rejected
      if (version.key) {
        // Use the stored key directly if available
        await deleteFile(version.key);
        console.log(`Deleted file with key ${version.key} from S3`);
      } else if (version.fileUrl) {
        // Try to extract key from URL if key is not stored directly
        try {
          const fileKey = version.fileUrl.split('.amazonaws.com/')[1];
          if (fileKey) {
            await deleteFile(fileKey);
            console.log(`Deleted file with extracted key ${fileKey} from S3`);
          } else {
            console.warn(`Could not extract file key from URL: ${version.fileUrl}`);
          }
        } catch (error) {
          console.error('Error extracting or deleting file:', error);
        }
      }
    }
    
    // Send notification to uploader
    await notifyVersionStatus(version, status, project);
    
    // Log activity
    await activityService.logActivity(projectId, userId, status === 'approved' ? 'version_approved' : 'version_rejected', 
      `Version ${version.versionNumber} ${status}`, {
      versionNumber: version.versionNumber
    });
    
    return res.status(200).json({
      success: true,
      message: `Version ${status}`,
      data: version
    });
  } catch (error) {
    console.error('Update version status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating version status'
    });
  }
};

// @desc    Delete version
// @route   DELETE /api/projects/:projectId/versions/:versionId
// @access  Private (creator only)
const deleteVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    const userId = req.user._id;
    
    // Project is loaded in middleware
    const project = req.project;
    
    // Only creator can delete versions
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can delete versions'
      });
    }
    
    const version = await Version.findOne({
      _id: versionId,
      project: projectId
    });
    
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }
    
    // Remove version from project's versions array
    project.versions = project.versions.filter(
      v => v.toString() !== versionId
    );
    
    // If this was the current version, set to the most recent
    if (project.currentVersion && project.currentVersion.toString() === versionId) {
      const latestVersion = await Version.findOne({
        project: projectId,
        status: 'approved',
        _id: { $ne: versionId }
      }).sort({ versionNumber: -1 });
      
      project.currentVersion = latestVersion ? latestVersion._id : null;
    }
    
    await project.save();
    
    // Delete version document
    await Version.findByIdAndDelete(versionId);
    
    // Delete file from S3
    const fileKey = version.fileUrl.split('.amazonaws.com/')[1];
    await deleteFile(fileKey);
    
    // Log activity
    await activityService.logActivity(projectId, userId, 'version_deleted', `Version ${version.versionNumber} deleted`, {
      versionNumber: version.versionNumber
    });
    
    return res.status(200).json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error) {
    console.error('Delete version error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting version'
    });
  }
};

// @desc    Revert to a specific version (deleting all newer versions)
// @route   POST /api/projects/:projectId/versions/:versionId/revert
// @access  Private (creator only)
const revertToVersion = async (req, res) => {
  try {
    const { projectId, versionId } = req.params;
    const userId = req.user._id;
    
    // Project is loaded in middleware
    const project = req.project;
    
    // Only creator can revert versions
    if (project.creator.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the project creator can revert versions'
      });
    }
    
    // Check if the specified version exists and belongs to this project
    const targetVersion = await Version.findOne({
      _id: versionId,
      project: projectId,
      status: 'approved'
    });
    
    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        message: 'Version not found or not approved'
      });
    }
    
    // Find all approved versions with higher version numbers
    const newerVersions = await Version.find({
      project: projectId,
      versionNumber: { $gt: targetVersion.versionNumber },
      status: 'approved'
    });
    
    console.log(`Found ${newerVersions.length} newer versions to delete when reverting to version ${targetVersion.versionNumber}`);
    
    // Delete all newer versions (files and database records)
    let deletedCount = 0;
    for (const version of newerVersions) {
      // Delete file from S3
      if (version.key) {
        try {
          await deleteFile(version.key);
          console.log(`Deleted file for version ${version.versionNumber} with key ${version.key}`);
        } catch (error) {
          console.error(`Error deleting file for version ${version.versionNumber}:`, error);
        }
      } else if (version.fileUrl) {
        try {
          const fileKey = version.fileUrl.split('.amazonaws.com/')[1];
          if (fileKey) {
            await deleteFile(fileKey);
            console.log(`Deleted file for version ${version.versionNumber} with extracted key ${fileKey}`);
          }
        } catch (error) {
          console.error(`Error deleting file for version ${version.versionNumber}:`, error);
        }
      }
      
      // Remove from project's versions array
      project.versions = project.versions.filter(v => v.toString() !== version._id.toString());
      
      // Delete database record
      await Version.findByIdAndDelete(version._id);
      deletedCount++;
    }
    
    // Update project's current version to the target version
    project.currentVersion = targetVersion._id;
    await project.save();
    
    // Log activity
    await activityService.logActivity(projectId, userId, 'version_reverted', `Reverted to version ${targetVersion.versionNumber}`, {
      versionNumber: targetVersion.versionNumber,
      deletedVersions: deletedCount
    });
    
    return res.status(200).json({
      success: true,
      message: `Successfully reverted to version ${targetVersion.versionNumber}`,
      data: {
        deletedVersions: deletedCount,
        currentVersion: targetVersion.versionNumber
      }
    });
  } catch (error) {
    console.error('Revert to version error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error when reverting to version'
    });
  }
};

module.exports = {
  getVersions,
  getUploadUrl,
  uploadFile,
  createVersion,
  getVersion,
  updateVersionStatus,
  deleteVersion,
  revertToVersion
};