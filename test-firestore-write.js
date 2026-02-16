// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Test write
db.collection('users')
  .doc('TEST_UID_12345')
  .set({
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    dateOfBirth: '1990-01-01',
    role: 'user',
    createdAt: Date.now(),
  })
  .then(() => {
    console.log('✅ Test write successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test write failed:', error.message);
    process.exit(1);
  });
