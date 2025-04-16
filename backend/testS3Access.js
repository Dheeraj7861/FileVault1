const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables - must be done before other imports
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Import models and S3 config 
const Version = require('./models/version.model');
const s3Config = require('./config/s3');
const { s3, getSignedDownloadUrl } = require('./config/s3');
const bucketName = process.env.AWS_S3_BUCKET_NAME;

console.log('S3 ACCESS TEST UTILITY');
console.log('=====================');
console.log('Environment variables:');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not Set');
console.log('AWS_REGION:', process.env.AWS_REGION);
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME);

// Connect to MongoDB
async function runTests() {
  try {
    console.log('\nConnecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get recent versions
    console.log('\nFetching recent versions from database...');
    const versions = await Version.find().sort({ createdAt: -1 }).limit(5);
    console.log(`Found ${versions.length} versions`);

    // List all S3 objects in the bucket
    console.log('\nListing S3 objects in bucket...');
    const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();
    console.log(`Found ${objects.Contents.length} objects in bucket`);

    // Print first few objects
    console.log('\nFirst 5 objects in S3:');
    for (let i = 0; i < Math.min(5, objects.Contents.length); i++) {
      const object = objects.Contents[i];
      console.log(`- Key: ${object.Key}, Size: ${object.Size} bytes, LastModified: ${object.LastModified}`);
    }

    // Test access to recent versions
    console.log('\nTesting access to recent versions:');
    for (const version of versions) {
      console.log(`\nVersion ID: ${version._id}, Version #: ${version.versionNumber}`);
      console.log(`- File: ${version.fileName}`);
      console.log(`- URL stored: ${version.fileUrl}`);
      console.log(`- Key stored: ${version.key || 'Not stored'}`);

      // Try to generate direct S3 URL
      const directUrl = version.key ? 
        `https://${bucketName}.s3.amazonaws.com/${version.key}` : 
        'No key available';
      console.log(`- Direct S3 URL: ${directUrl}`);

      // Try to access the file via S3 API
      if (version.key) {
        try {
          console.log(`- Checking if object exists in S3...`);
          const result = await s3.headObject({
            Bucket: bucketName,
            Key: version.key
          }).promise();
          console.log(`  ✓ File exists! ContentType: ${result.ContentType}, Size: ${result.ContentLength} bytes`);
        } catch (err) {
          console.log(`  ✗ Error: ${err.message}`);
        }
      }
    }

    console.log('\nS3 Test completed');
  } catch (error) {
    console.error('Error in tests:', error);
  } finally {
    mongoose.disconnect();
  }
}

runTests(); 