import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { NotificationType } from '../types/models';

/**
 * Creates a notification for a specific user.
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      title,
      message,
      link,
      read: false,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Failed to send user notification:', error);
  }
}

/**
 * Creates a notification for all admin users in the system.
 */
export async function notifyAdmins(
  type: NotificationType,
  title: string,
  message: string,
  link?: string,
) {
  try {
    // 1. Fetch all admin users
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));
    const snap = await getDocs(q);
    const adminIds = snap.docs.map((doc) => doc.id);

    // 2. Create a notification for each admin
    const promises = adminIds.map((adminId) =>
      addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type,
        title,
        message,
        link,
        read: false,
        createdAt: Date.now(),
      }),
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Failed to send admin notifications:', error);
  }
}
