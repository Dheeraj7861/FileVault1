// Import AWS SDK
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Debug environment variables - with actual values redacted for security
console.log('AWS Environment Variables Status:');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not Set');
console.log('AWS_REGION:', process.env.AWS_REGION || 'Default: us-east-1');
console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || 'Default: project-nexus-files');

// Validate required AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('ERROR: AWS credentials are missing. Please check your .env file.');
  console.error('S3 functionality will not work without valid AWS credentials.');
}

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'project-nexus-files';

// Configure CORS for the S3 bucket
const configureBucketCors = async () => {
  // Skip CORS configuration if credentials are missing
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('Skipping S3 CORS configuration: AWS credentials are missing');
    return;
  }

  const corsParams = {
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['PUT', 'POST', 'GET', 'DELETE'],
          AllowedOrigins: [
            'http://localhost:8080',
            'http://localhost:5173',
            process.env.CLIENT_URL || '*'
          ],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000
        }
      ]
    }
  };

  try {
    await s3.putBucketCors(corsParams).promise();
    console.log('S3 bucket CORS configuration applied successfully');
  } catch (error) {
    // Don't let CORS configuration failure stop the application
    console.error('Error configuring S3 bucket CORS:', error.message);
    console.warn('Continuing without CORS configuration. File uploads may be affected.');
  }
};

// Call the CORS configuration function but don't wait for it
configureBucketCors().catch(err => {
  console.warn('CORS configuration failed but continuing server startup');
});

// Generate a pre-signed URL for uploading
const getSignedUploadUrl = async (fileType, fileName, projectId, versionNumber) => {
  const fileExtension = fileName.split('.').pop();
  
  // Get version number if not provided (used for client-side uploads)
  let version = versionNumber;
  if (!version && projectId) {
    // Required imports
    const Version = require('../models/version.model');
    
    // Get the next version number
    const lastVersion = await Version.findOne({ project: projectId })
      .sort({ versionNumber: -1 });
    
    version = lastVersion ? lastVersion.versionNumber + 1 : 1;
  }
  
  // Organize by project/version structure
  const key = projectId 
    ? `projects/${projectId}/versions/v${version}-${uuidv4()}.${fileExtension}`
    : `uploads/${uuidv4()}.${fileExtension}`;
  
  const params = {
    Bucket: bucketName,
    Key: key,
    ContentType: fileType,
    Expires: 60 * 15 // 15 minutes
  };
  
  try {
    const signedUrl = await s3.getSignedUrlPromise('putObject', params);
    return {
      signedUrl,
      key,
      fileUrl: `https://${bucketName}.s3.amazonaws.com/${key}`,
      versionNumber: version
    };
  } catch (error) {
    throw new Error(`Error generating signed URL: ${error.message}`);
  }
};

// Generate a pre-signed URL for downloading
const getSignedDownloadUrl = async (key, expirationSeconds = 900) => { // Default 15 minutes
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expirationSeconds
  };
  
  try {
    const signedUrl = await s3.getSignedUrlPromise('getObject', params);
    console.log(`Generated download URL for ${key} with ${expirationSeconds}s expiration`);
    return signedUrl;
  } catch (error) {
    throw new Error(`Error generating download URL: ${error.message}`);
  }
};

// Delete a file from S3
const deleteFile = async (key) => {
  const params = {
    Bucket: bucketName,
    Key: key
  };
  
  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    throw new Error(`Error deleting file: ${error.message}`);
  }
};

module.exports = {
  s3,
  getSignedUploadUrl,
  getSignedDownloadUrl,
  deleteFile
}; 