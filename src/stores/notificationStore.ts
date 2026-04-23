/**
 * @file notificationStore.ts
 * @description Pinia store for managing user notifications and alerts.
 * @author Nurse Hub Team
 * @created 2026-03-05
 * @modified 2026-04-23
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  type Unsubscribe,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { ShiftRequest, Notification as AppNotification } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0);
  const pendingRequestsCount = ref(0);
  const notifications = ref<AppNotification[]>([]);
  let unsubscribe: Unsubscribe | null = null;

  function incrementUnread() {
    unreadCount.value++;
  }

  async function resetUnread() {
    if (notifications.value.length === 0) {
      unreadCount.value = 0;
      return;
    }

    try {
      const batch = writeBatch(db);
      notifications.value.forEach((n) => {
        const notifRef = doc(db, 'notifications', n.id);
        batch.update(notifRef, { read: true });
      });

      await batch.commit();
      // The onSnapshot listener will automatically clear the list and update count
      // because they no longer match the 'read == false' query.
    } catch (error) {
      useSecureLogger().error('Error marking notifications as read', error);
      // Fallback: local clear anyway
      unreadCount.value = 0;
      notifications.value = [];
    }
  }

  function setPendingRequestsCount(count: number) {
    pendingRequestsCount.value = count;
  }

  /**
   * Global listener for Admins to watch ALL pending requests
   */
  function initAdminListener(onNewRequest?: (req: ShiftRequest) => void) {
    if (unsubscribe) unsubscribe();

    // We don't want to notify for everything initially, so we flag the first snapshot
    let isInitial = true;

    const q = query(
      collection(db, 'shiftRequests'),
      where('status', '==', 'OPEN'),
      orderBy('createdAt', 'desc'),
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      pendingRequestsCount.value = snapshot.size;

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            incrementUnread();
            if (onNewRequest)
              onNewRequest({ id: change.doc.id, ...change.doc.data() } as ShiftRequest);
          }
        });
      }
      isInitial = false;
    });
  }

  /**
   * Global listener for Users to watch their OWN requests for status updates
   */
  function initUserListener(userId: string, onUpdate?: (req: ShiftRequest) => void) {
    if (unsubscribe) unsubscribe();
    let isInitial = true;

    const q = query(
      collection(db, 'shiftRequests'),
      where('creatorId', '==', userId),
      orderBy('createdAt', 'desc'),
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            if (onUpdate) onUpdate({ id: change.doc.id, ...change.doc.data() } as ShiftRequest);
          }
        });
      }
      isInitial = false;
    });
  }

  /**
   * Global listener for In-App notifications
   */
  function initInAppListener(userId: string, onNewNotification?: (n: AppNotification) => void) {
    // Note: We use a separate unsubscribe for in-app notifications
    // to allow it to run alongside admin/user request listeners
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
    );

    let isInitial = true;

    const unsubNotif = onSnapshot(q, (snapshot) => {
      unreadCount.value = snapshot.size;
      notifications.value = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            if (onNewNotification) {
              onNewNotification({ id: change.doc.id, ...change.doc.data() } as AppNotification);
            }
          }
        });
      }
      isInitial = false;
    });

    return unsubNotif; // Return to be managed by the component
  }

  function stopListeners() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    unreadCount,
    pendingRequestsCount,
    notifications,
    incrementUnread,
    resetUnread,
    setPendingRequestsCount,
    initAdminListener,
    initUserListener,
    initInAppListener,
    stopListeners,
  };
});
