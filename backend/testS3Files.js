const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Get version model
const Version = require('./models/version.model');
const bucketName = process.env.AWS_S3_BUCKET_NAME;

async function testS3Files() {
  try {
    console.log('S3 File Access Test');
    console.log('=================');
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get some versions to test
    const versions = await Version.find().sort({ createdAt: -1 }).limit(3);
    console.log(`Found ${versions.length} versions to test`);
    
    for (const version of versions) {
      console.log(`\nTesting Version ${version._id}`);
      console.log(`File: ${version.fileName}`);
      console.log(`Original URL: ${version.fileUrl}`);
      
      // Direct URL from key if available
      let directUrl = null;
      if (version.key) {
        directUrl = `https://${bucketName}.s3.amazonaws.com/${version.key}`;
        console.log(`Direct URL from key: ${directUrl}`);
      }
      
      // Try to access original URL
      try {
        console.log(`Testing access to original URL...`);
        const response = await axios.head(version.fileUrl, { timeout: 5000 });
        console.log(`✓ Original URL is accessible! Status: ${response.status}`);
        console.log(`  Content-Type: ${response.headers['content-type']}`);
        console.log(`  Content-Length: ${response.headers['content-length']} bytes`);
      } catch (error) {
        console.error(`✗ Original URL test failed: ${error.message}`);
        if (error.response) {
          console.error(`  Status: ${error.response.status}`);
          console.error(`  Data: ${JSON.stringify(error.response.data)}`);
        }
      }
      
      // Try direct URL if available
      if (directUrl) {
        try {
          console.log(`Testing access to direct URL...`);
          const response = await axios.head(directUrl, { timeout: 5000 });
          console.log(`✓ Direct URL is accessible! Status: ${response.status}`);
          console.log(`  Content-Type: ${response.headers['content-type']}`);
          console.log(`  Content-Length: ${response.headers['content-length']} bytes`);
        } catch (error) {
          console.error(`✗ Direct URL test failed: ${error.message}`);
          if (error.response) {
            console.error(`  Status: ${error.response.status}`);
            console.error(`  Data: ${JSON.stringify(error.response.data)}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error running test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nTests completed');
  }
}

testS3Files(); 