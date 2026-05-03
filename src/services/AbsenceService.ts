/**
 * @file AbsenceService.ts
 * @description Service for managing absence requests and shift shortages.
 */
import { db } from '../boot/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { ShiftRequest } from '../types/models';

export class AbsenceService {
  private collectionName = 'shiftRequests';

  /**
   * Creates a new absence request (ShiftRequest) in Firestore
   */
  async createRequest(request: Omit<ShiftRequest, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), request);
    return docRef.id;
  }

  /**
   * Updates an existing request
   */
  async updateRequest(id: string, updates: Partial<ShiftRequest>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, updates);
  }

  /**
   * Deletes a request
   */
  async deleteRequest(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }

  /**
   * Fetches requests for a specific configuration
   */
  async getRequestsByConfig(configId: string): Promise<ShiftRequest[]> {
    const q = query(
      collection(db, this.collectionName),
      where('configId', '==', configId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftRequest));
  }
}

export const absenceService = new AbsenceService();
