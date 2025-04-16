const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/project.controller');
const { protect, checkProjectAccess } = require('../middleware/auth');
const User = require('../models/user.model');
const Project = require('../models/project.model');

// Add a public test endpoint BEFORE protect middleware
router.get('/test-visibility', async (req, res) => {
  console.log('[TEST] test-visibility endpoint accessed');
  
  try {
    // Get all users and projects
    const allUsers = await User.find({});
    const allProjects = await Project.find({});
    
    console.log(`[TEST] Found ${allUsers.length} users and ${allProjects.length} projects`);
    
    return res.status(200).json({
      success: true,
      message: `Test endpoint working. Found ${allUsers.length} users and ${allProjects.length} projects.`
    });
  } catch (error) {
    console.error('[TEST-ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message
    });
  }
});

// Add a test endpoint for project access
router.get('/test-project-access/:projectId', async (req, res) => {
  console.log('[TEST] Testing project access for:', req.params.projectId);
  
  try {
    const projectId = req.params.projectId;
    
    // Get the project
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Get all users
    const allUsers = await User.find({}).select('_id email name');
    
    // Check access for each user
    const accessResults = [];
    
    for (const user of allUsers) {
      const userAccess = project.accessibleBy.find(
        access => access.user && access.user.toString() === user._id.toString()
      );
      
      const accessCheck = {
        userId: user._id,
        email: user.email,
        name: user.name,
        hasAccess: !!userAccess,
        accessType: userAccess ? userAccess.accessType : 'none',
        canView: userAccess ? project.hasAccess(user._id, 'view') : false,
        canEdit: userAccess ? project.hasAccess(user._id, 'edit') : false,
        canAdmin: userAccess ? project.hasAccess(user._id, 'admin') : false
      };
      
      accessResults.push(accessCheck);
    }
    
    return res.status(200).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        creator: project.creator
      },
      accessResults
    });
  } catch (error) {
    console.error('[TEST-PROJECT-ACCESS-ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Test project access error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// All routes after this line are protected
router.use(protect);

// Debug route to check routing
router.get('/debug', (req, res) => {
  console.log('Debug route accessed');
  res.status(200).json({
    success: true,
    message: 'Debug route is working',
    user: req.user._id
  });
});

// Custom middleware to catch errors for specific routes
const catchRoute = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Project routes
router.route('/')
  .get(getProjects)
  .post(createProject);

// Add the fix-visibility route BEFORE the projectId routes
// Add a new route to fix project visibility
router.get('/fix-visibility', catchRoute(async (req, res) => {
  console.log('[ROUTE] /fix-visibility endpoint was hit');
  console.log('[USER] User ID:', req.user?._id);
  
  try {
    console.log('[DEBUG] Starting fix-visibility process');
    
    // Get all users and projects
    const allUsers = await User.find({});
    console.log(`[USERS] Found ${allUsers.length} users`);
    
    const allProjects = await Project.find({});
    console.log(`[PROJECTS] Found ${allProjects.length} projects`);
    
    let updatedProjects = 0;
    
    // For each project, ensure all users have at least viewer access
    for (const project of allProjects) {
      let updated = false;
      console.log(`[PROJECT] Processing project: ${project._id} (${project.name})`);
      
      // Check each user
      for (const user of allUsers) {
        // Skip if this is the project creator (they should already have creator access)
        if (project.creator.toString() === user._id.toString()) {
          console.log(`[SKIP] User ${user._id} is the creator of project ${project._id}`);
          continue;
        }
        
        // Check if user already has access
        const hasAccess = project.accessibleBy.some(
          access => access.user && access.user.toString() === user._id.toString()
        );
        
        // If user doesn't have access, add them as a viewer
        if (!hasAccess) {
          console.log(`[ADD] Adding user ${user._id} as viewer to project ${project._id}`);
          project.accessibleBy.push({
            user: user._id,
            accessType: 'viewer',
            addedAt: Date.now()
          });
          updated = true;
        } else {
          console.log(`[SKIP] User ${user._id} already has access to project ${project._id}`);
        }
      }
      
      // Save project if it was updated
      if (updated) {
        console.log(`[SAVE] Saving updated project ${project._id}`);
        await project.save();
        updatedProjects++;
      } else {
        console.log(`[SKIP] No updates needed for project ${project._id}`);
      }
    }
    
    console.log(`[COMPLETE] Updated ${updatedProjects} projects`);
    
    return res.status(200).json({
      success: true,
      message: `All projects have been made accessible to all users. Updated ${updatedProjects} projects.`
    });
  } catch (error) {
    console.error('[ERROR] Error making projects accessible:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fixing project visibility',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

router.route('/:projectId')
  .get(checkProjectAccess('view'), getProject)
  .put(checkProjectAccess('edit'), updateProject)
  .delete(checkProjectAccess('admin'), deleteProject);

// User management routes
router.route('/:projectId/users')
  .post(checkProjectAccess('admin'), addUserToProject);

router.route('/:projectId/users/:userId')
  .delete(checkProjectAccess('admin'), removeUserFromProject);

// Access request routes
router.post('/:projectId/request-access', requestAccess);
router.get('/:projectId/access-requests', checkProjectAccess('admin'), getAccessRequests);
router.put('/:projectId/access-requests/:requestId', checkProjectAccess('admin'), handleAccessRequest);

// Sharing
router.post('/:projectId/share', checkProjectAccess('view'), generateShareLink);

module.exports = router; 