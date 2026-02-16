/**
 * @file NotificationService.ts
 * @description Service for managing in-app notifications
 * @author Nurse Hub Team
 */

import { collection, doc, setDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { Notification, NotificationType } from '../types/models';

/**
 * Create a new notification for a user
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  message: string,
  requestId?: string,
): Promise<void> {
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
