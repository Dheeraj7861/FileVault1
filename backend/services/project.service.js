const Project = require('../models/project.model');

/**
 * Get a project by ID
 * @param {string} projectId - The project ID
 * @returns {Promise<Object|null>} The project if found, null otherwise
 */
const getProjectById = async (projectId) => {
  try {
    return await Project.findById(projectId);
  } catch (error) {
    console.error('Error finding project:', error);
    throw error;
  }
};

/**
 * Check if user has access to a project
 * @param {string} projectId - The project ID
 * @param {string} userId - The user ID
 * @returns {boolean} Whether the user has access to the project
 */
const isUserProjectCollaborator = async (projectId, userId) => {
  try {
    // Simple implementation - check if user is in project's accessibleBy array
    const project = await Project.findById(projectId);
    if (!project) return false;
    
    // Check if user is a collaborator (accessibleBy contains the user ID)
    const isCollaborator = project.accessibleBy && 
                           project.accessibleBy.some(access => 
                             access.user && 
                             access.user.toString() === userId.toString()
                           );
    
    return isCollaborator;
  } catch (error) {
    console.error('Error checking project access:', error);
    return false;
  }
};

module.exports = {
  getProjectById,
  isUserProjectCollaborator
}; 