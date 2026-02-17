import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { ShiftRequest } from '../types/models';

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0);
  const pendingRequestsCount = ref(0);
  let unsubscribe: Unsubscribe | null = null;

  function incrementUnread() {
    unreadCount.value++;
  }

  function resetUnread() {
    unreadCount.value = 0;
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

  function stopListeners() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    unreadCount,
    pendingRequestsCount,
    incrementUnread,
    resetUnread,
    setPendingRequestsCount,
    initAdminListener,
    initUserListener,
    stopListeners,
  };
});
