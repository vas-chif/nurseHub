/* eslint-env serviceworker */
/* global importScripts, firebase */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Add your Firebase configuration here
const firebaseConfig = {
  apiKey: new URL(location).searchParams.get('apiKey') || 'AIzaSyD37bwODUeDZ6-1AfP21q1e9lnJel3zuek',
  authDomain: 'nursehub-cbb32.firebaseapp.com',
  projectId: 'nursehub-cbb32',
  storageBucket: 'nursehub-cbb32.firebasestorage.app',
  messagingSenderId: '242317049138',
  appId: '1:242317049138:web:fb40c27e0a6bb6fc02eb2b',
};

// Initialize the Firebase app in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Phase 49: Explicit showNotification required on Android 14+ / Chrome PWA.
  // On killed PWA, Firebase auto-display silently fails — we must call showNotification explicitly.
  const title = payload.notification?.title || 'NurseHub';
  const options = {
    body: payload.notification?.body || '',
    icon: 'https://nursehub-psi.vercel.app/icons/icon-192x192.png',
    badge: 'https://nursehub-psi.vercel.app/icons/icon-128x128.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: payload.data?.requestId || 'nursehub-notification',
    renotify: true,
  };
  self.registration.showNotification(title, options);
});
