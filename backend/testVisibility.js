const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Models
const User = require('./models/user.model');
const Project = require('./models/project.model');

async function fixVisibility() {
  console.log('=== STARTING VISIBILITY FIX TEST ===');
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB!');
    
    // Get all users and projects
    console.log('Fetching users...');
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users`);
    
    console.log('Fetching projects...');
    const allProjects = await Project.find({});
    console.log(`Found ${allProjects.length} projects`);
    
    if (allProjects.length === 0) {
      console.log('No projects found. Nothing to fix.');
      return;
    }
    
    let updatedProjects = 0;
    
    // For each project, ensure all users have at least viewer access
    for (const project of allProjects) {
      console.log(`\nProcessing project: ${project._id} (${project.name})`);
      console.log(`Creator: ${project.creator}`);
      console.log(`Current access list: ${JSON.stringify(project.accessibleBy.map(a => ({
        user: a.user.toString(),
        type: a.accessType
      })))}`);
      
      let updated = false;
      
      // Check each user
      for (const user of allUsers) {
        // Skip if this is the project creator (they should already have creator access)
        if (project.creator.toString() === user._id.toString()) {
          console.log(`User ${user._id} (${user.email}) is the creator - skipping`);
          continue;
        }
        
        // Check if user already has access
        const hasAccess = project.accessibleBy.some(
          access => access.user && access.user.toString() === user._id.toString()
        );
        
        // If user doesn't have access, add them as a viewer
        if (!hasAccess) {
          console.log(`Adding user ${user._id} (${user.email}) as viewer to project ${project._id}`);
          project.accessibleBy.push({
            user: user._id,
            accessType: 'viewer',
            addedAt: Date.now()
          });
          updated = true;
        } else {
          console.log(`User ${user._id} (${user.email}) already has access - skipping`);
        }
      }
      
      // Save project if it was updated
      if (updated) {
        console.log(`Saving updated project ${project._id}`);
        await project.save();
        updatedProjects++;
      } else {
        console.log(`No updates needed for project ${project._id}`);
      }
    }
    
    console.log(`\n=== COMPLETED ===`);
    console.log(`Updated ${updatedProjects} out of ${allProjects.length} projects`);
    
  } catch (error) {
    console.error('ERROR:', error);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the function
fixVisibility(); 