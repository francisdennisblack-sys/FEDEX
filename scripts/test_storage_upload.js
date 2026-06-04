#!/usr/bin/env node
// Simple test uploader using Firebase Admin SDK to verify Storage permissions
// Usage: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
// then: node scripts/test_storage_upload.js /path/to/local.jpg

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
if (!fs.existsSync(keyPath)) {
  console.error('Service account key not found at', keyPath);
  console.error('Set environment variable GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in repository root.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath))
});

const bucketName = 'wificontent-143da.appspot.com';
const bucket = admin.storage().bucket(bucketName);

const localFile = process.argv[2];
if (!localFile) {
  console.error('Usage: node scripts/test_storage_upload.js <local-file>');
  process.exit(1);
}

const dest = `test-uploads/${path.basename(localFile)}`;

bucket.upload(localFile, { destination: dest })
  .then(() => {
    console.log('Upload success:', dest);
    console.log(`Public link: https://storage.googleapis.com/${bucketName}/${dest}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Upload error:');
    console.error(err);
    process.exit(2);
  });
