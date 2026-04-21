/**
 * @file NotificationService.ts
 * @description Service for managing in-app notifications
 * @author Nurse Hub Team
 */

import { collection, doc, setDoc, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, messaging } from '../boot/firebase';
import { getToken } from 'firebase/messaging';
import type { Notification, NotificationType, ShiftRequest, ShiftSwap } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

/**
 * Request permission for notifications and register FCM token
 */
export async function requestNotificationPermission(userId: string): Promise<void> {
  if (!messaging) {
    logger.warn('Messaging not supported, skipping permission request');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      if (token) {
        await registerFCMToken(userId, token);
        logger.info('FCM Token registered successfully');
      }
    } else {
      logger.warn('Notification permission denied');
    }
  } catch (error) {
    logger.error('Error requesting notification permission', error);
  }
}

/**
 * Save FCM token to user document
 */
export async function registerFCMToken(userId: string, token: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    fcmTokens: arrayUnion(token),
  });
}

/**
 * Create a new notification for a user and trigger a Web Push via Vercel
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  message: string,
  requestId?: string,
): Promise<void> {
  // 1. Salva la notifica in-app su Firestore (esiste già)
  const notifRef = doc(collection(db, 'notifications'));
  await setDoc(notifRef, {
    id: notifRef.id,
    userId,
    type,
    message,
    requestId,
    read: false,
    createdAt: Date.now(),
  } as Notification);

  // 2. Invia la Notifica Push vera e propria tramite Vercel
  try {
    // Recupera i token FCM dell'utente bersaglio
    const userDocRef = doc(db, 'users', userId);
    const { getDoc } = await import('firebase/firestore');
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const rawFcmTokens = userData?.fcmTokens || [];

      // Deduplicate tokens to prevent multiple pushes to the same device
      const fcmTokens = Array.from(new Set(rawFcmTokens));

      if (fcmTokens.length > 0) {
        // Chiama la nostra API gratuita su Vercel
        const vercelRes = await fetch('https://nursehub-psi.vercel.app/api/send-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Inserisci qui la Password Segreta che hai generato su Vercel!
            Authorization: `Bearer ${import.meta.env.VITE_VERCEL_API_SECRET}`,
          },
          body: JSON.stringify({
            title: 'NurseHub Update',
            body: message,
            url: '/', // Puoi personalizzare l'URL in base al tipo di notifica
            fcmTokens: fcmTokens,
          }),
        });

        if (!vercelRes.ok) {
          console.error('Failed to trigger Vercel Push:', await vercelRes.text());
        }
      }
    }
  } catch (error) {
    console.error('Error sending Push Notification via Vercel:', error);
  }
}

/**
 * Get all unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data() as Notification);
}

/**
 * Get all notifications for a user (read + unread)
 */
export async function getAllNotifications(userId: string): Promise<Notification[]> {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => doc.data() as Notification)
    .sort((a, b) => b.createdAt - a.createdAt); // Most recent first
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, 'notifications', notificationId);
  await updateDoc(notifRef, { read: true });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
  );

  const snapshot = await getDocs(q);
  const promises = snapshot.docs.map((doc) => updateDoc(doc.ref, { read: true }));
  await Promise.all(promises);
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const notifications = await getUnreadNotifications(userId);
  return notifications.length;
}

/**
 * NEW: Notify all eligible operators when a new request is created
 */
export async function notifyEligibleOperators(
  requestObj: ShiftRequest,
  activeConfigId: string,
): Promise<void> {
  try {
    if (!activeConfigId) return;

    // Import here to avoid circular logic or initialization issues, though standard imports work too.
    const { collection, getDocs } = await import('firebase/firestore');
    const { useShiftLogic } = await import('../composables/useShiftLogic');
    const { getCompatibleScenarios } = useShiftLogic();

    // 1. Fetch all operators in this configuration
    const opsRef = collection(db, 'systemConfigurations', activeConfigId, 'operators');
    const opsSnap = await getDocs(opsRef);

    // Fetch users to map operatorId -> Firebase UID
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const operatorToUserIdMap = new Map<string, string>();
    usersSnap.docs.forEach((doc) => {
      const uData = doc.data();
      if (uData.operatorId) {
        operatorToUserIdMap.set(uData.operatorId, doc.id); // doc.id is the UID
      }
    });

    const notifiedUids = new Set<string>();

    for (const opDoc of opsSnap.docs) {
      const opData = opDoc.data();
      const opId = opDoc.id;
      const opUserId = operatorToUserIdMap.get(opId); // Recover the Firebase UID

      // Skip the person who just created the request (or the absent person)
      if (opId === requestObj.absentOperatorId || !opUserId) {
        continue;
      }

      // Skip if this user was already notified for this request
      if (notifiedUids.has(opUserId)) {
        continue;
      }

      // 2. Check Compatibility
      const opShift = opData.schedule?.[requestObj.date] || 'R';
      const compatible = getCompatibleScenarios(
        requestObj.originalShift,
        opShift,
        requestObj.date,
        opData.schedule,
      );

      // 3. If compatible, trigger notification!
      if (compatible && compatible.length > 0) {
        notifiedUids.add(opUserId); // Mark as notified
        const messageStr = `Nuovo turno scoperto: ${requestObj.date} (Turno ${requestObj.originalShift}). Sei compatibile!`;
        // Chiamata fire-and-forget
        notifyUser(opUserId, 'NEW_OPPORTUNITY', messageStr, requestObj.id).catch((e) =>
          console.error('Silent fail on notifyUser', e),
        );
      }
    }
  } catch (err) {
    console.error('Error in notifyEligibleOperators:', err);
  }
}

/**
 * NEW: Notify all Admins when an event occurs (e.g. new offer submitted)
 */
export async function notifyAdmins(
  messageStr: string,
  requestId: string,
  activeConfigId: string,
): Promise<void> {
  try {
    if (!activeConfigId) return;

    const { collection, query, where, getDocs } = await import('firebase/firestore');

    // Fetch all users who are admins and belong to this configuration
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'admin'),
      where('configId', '==', activeConfigId),
    );

    const adminsSnap = await getDocs(q);
    const notifiedUids = new Set<string>();

    for (const adminDoc of adminsSnap.docs) {
      const adminData = adminDoc.data();
      const adminUid = adminData.uid || adminDoc.id; // Fallback to doc.id if uid is missing

      if (adminUid && !notifiedUids.has(adminUid)) {
        notifiedUids.add(adminUid);
        // Chiamata fire-and-forget
        notifyUser(adminUid, 'NEW_REQUEST', messageStr, requestId).catch((e) =>
          console.error('Silent fail on notifyAdmins', e),
        );
      }
    }
  } catch (err) {
    console.error('Error in notifyAdmins:', err);
  }
}

/**
 * NEW: Notify operators eligible for a shift swap
 */
export async function notifyEligibleSwappers(
  swapObj: ShiftSwap,
  activeConfigId: string,
): Promise<void> {
  try {
    if (!activeConfigId) return;

    const { collection, getDocs } = await import('firebase/firestore');

    // 1. Fetch all operators in this configuration
    const opsRef = collection(db, 'systemConfigurations', activeConfigId, 'operators');
    const opsSnap = await getDocs(opsRef);

    // Fetch users to map operatorId -> Firebase UID
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    const operatorToUserIdMap = new Map<string, string>();
    usersSnap.docs.forEach((doc) => {
      const uData = doc.data();
      if (uData.operatorId) {
        operatorToUserIdMap.set(uData.operatorId, doc.id);
      }
    });

    const notifiedUids = new Set<string>();

    for (const opDoc of opsSnap.docs) {
      const opData = opDoc.data();
      const opId = opDoc.id;
      const opUserId = operatorToUserIdMap.get(opId);

      // Skip the creator
      if (opId === swapObj.creatorOperatorId || !opUserId) {
        continue;
      }

      if (notifiedUids.has(opUserId)) {
        continue;
      }

      // Check if this operator has the desired shift on that date
      const opShift = opData.schedule?.[swapObj.date];

      if (opShift === swapObj.desiredShift) {
        notifiedUids.add(opUserId);
        const messageStr = `Nuovo cambio turno: Un collega offre ${swapObj.offeredShift} per il tuo ${swapObj.desiredShift} del ${swapObj.date}!`;
        notifyUser(opUserId, 'NEW_OPPORTUNITY', messageStr, swapObj.id).catch((e) =>
          console.error('Silent fail on notifyUser', e),
        );
      }
    }
  } catch (err) {
    console.error('Error in notifyEligibleSwappers:', err);
  }
}
