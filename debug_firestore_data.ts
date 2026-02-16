import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { smartEnv } from './src/config/smartEnvironment';

const firebaseConfig = smartEnv.getFirebaseConfig();

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
  console.log('Fetching operators...');
  const q = query(collection(db, 'operators'), limit(5));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('No operators found.');
    return;
  }

  snapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`Operator: ${data.name} (ID: ${doc.id})`);
    console.log(
      'Schedule keys:',
      data.schedule ? Object.keys(data.schedule).length : 'Only undefined',
    );
    console.log(
      'Sample Schedule:',
      data.schedule ? JSON.stringify(data.schedule).slice(0, 100) : 'N/A',
    );
    console.log('---');
  });
}

checkData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
