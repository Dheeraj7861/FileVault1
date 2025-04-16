const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./models/user.model');

// Load environment variables
dotenv.config();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Parse and verify an existing token
function parseToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token is valid');
    console.log('Decoded token:', decoded);
    return decoded;
  } catch (error) {
    console.error('Token is invalid:', error.message);
    return null;
  }
}

// Generate a fresh token for a user
async function generateFreshToken() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB!');
    
    // Find the first user in the database
    const user = await User.findOne({});
    
    if (!user) {
      console.error('No users found in database');
      return null;
    }
    
    console.log(`Found user: ${user._id} (${user.email})`);
    
    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('\nGenerated token:');
    console.log(token);
    
    // Also verify the token
    parseToken(token);
    
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Check existing token if provided as argument
const existingToken = process.argv[2];
if (existingToken) {
  console.log('Parsing provided token...');
  parseToken(existingToken);
} else {
  // Generate a fresh token
  console.log('Generating a fresh token...');
  generateFreshToken();
} 