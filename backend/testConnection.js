const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('MongoDB Connection Test');
console.log('======================');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set (value hidden)' : 'Not Set');

// First test DNS resolution
const testDns = async () => {
  console.log('\nTesting DNS resolution...');
  try {
    // Extract hostname from MongoDB URI
    const uri = process.env.MONGODB_URI;
    const matches = uri.match(/mongodb\+srv:\/\/[^:]+:[^@]+@([^\/]+)/);
    
    if (matches && matches[1]) {
      const hostname = matches[1];
      console.log(`Testing DNS for hostname: ${hostname}`);
      
      // First test a known working DNS server
      console.log('Testing resolution of google.com (baseline test)');
      const googleAddresses = await dns.promises.resolve4('google.com');
      console.log(`✓ Successfully resolved google.com: ${googleAddresses.join(', ')}`);
      
      // Test SRV record for MongoDB
      console.log(`Testing SRV record _mongodb._tcp.${hostname}`);
      try {
        const srvRecords = await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`);
        console.log(`✓ Successfully resolved SRV records: Found ${srvRecords.length} records`);
      } catch (srvError) {
        console.error(`✗ Failed to resolve SRV records: ${srvError.message}`);
        console.log('Suggestion: Check your internet connection or try using a direct connection string without SRV');
      }
    } else {
      console.log('Could not extract hostname from MongoDB URI');
    }
  } catch (error) {
    console.error('DNS test error:', error);
  }
};

// Test MongoDB connection
const testMongoDbConnection = async () => {
  console.log('\nTesting MongoDB connection...');
  try {
    // Try with the SRV connection string
    console.log('Attempting to connect to MongoDB with current connection string...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Successfully connected to MongoDB!');
    await mongoose.disconnect();
  } catch (error) {
    console.error(`✗ Failed to connect to MongoDB: ${error.message}`);
    
    // Try with a direct connection string
    try {
      console.log('\nAttempting to create a direct connection string...');
      const uri = process.env.MONGODB_URI;
      const matches = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
      
      if (matches) {
        const [, username, password, hostname, dbName] = matches;
        // Try to get IP of the main hostname (this might not always work for MongoDB Atlas)
        try {
          console.log(`Trying to resolve IP address for ${hostname}`);
          const addresses = await dns.promises.resolve4(hostname);
          if (addresses && addresses.length > 0) {
            const directUri = `mongodb://${username}:${password}@${addresses[0]}:27017/${dbName}?retryWrites=true&w=majority`;
            console.log(`Created direct connection string using IP: ${addresses[0]}`);
            console.log('Attempting to connect with direct connection string...');
            
            try {
              await mongoose.connect(directUri);
              console.log('✓ Successfully connected with direct connection string!');
              await mongoose.disconnect();
            } catch (directError) {
              console.error(`✗ Failed to connect with direct connection string: ${directError.message}`);
            }
          } else {
            console.log('No IP addresses found');
          }
        } catch (dnsError) {
          console.error(`Could not resolve IP: ${dnsError.message}`);
        }
      } else {
        console.log('Could not parse MongoDB URI');
      }
    } catch (parseError) {
      console.error('Error parsing connection string:', parseError);
    }
  }
};

// Run tests
const runTests = async () => {
  try {
    await testDns();
    await testMongoDbConnection();
    
    console.log('\nSuggested Solutions:');
    console.log('1. Check your internet connection');
    console.log('2. Try using a different DNS server (like 8.8.8.8 or 1.1.1.1)');
    console.log('3. Update your MongoDB Atlas connection string in .env');
    console.log('4. Try using a direct connection string instead of SRV format');
  } catch (error) {
    console.error('Test execution error:', error);
  }
};

runTests(); 