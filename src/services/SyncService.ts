/**
 * @file SyncService.ts
 * @description Handles synchronization between Google Sheets (Source of Truth) and Firestore (Operational DB)
 * @author Nurse Hub Team
 */
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { GoogleSheetsService } from './GoogleSheetsService';
import type { Operator, ShiftRequest } from '../types/models';
import { db } from '../boot/firebase';

export class SyncService {
  private sheetsService: GoogleSheetsService;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
  }

  /**
   * Performs a full sync from Sheets to Firestore.
   * Strategy: Sheets is the master for static data (Operators, Schedule).
   * Firestore is updated to reflect Sheets state.
   */
  async syncOperatorsFromSheets(): Promise<void> {
    try {
      console.log('Starting sync from Sheets...');
      const operators = await this.sheetsService.fetchOperators();

      const batch = writeBatch(db);
      const operatorsRef = collection(db, 'operators');

      for (const op of operators) {
        const opDocRef = doc(operatorsRef, op.id);
        batch.set(
          opDocRef,
          {
            ...op,
            lastSync: serverTimestamp(),
          },
          { merge: true },
        );
      }

      await batch.commit();
      console.log(`Synced ${operators.length} operators to Firestore.`);
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves an operator by ID from Firestore.
   * If not found or stale, triggers a sync (optional strategy).
   */
  async getOperator(id: string): Promise<Operator | null> {
    const docRef = doc(db, 'operators', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as Operator;
    } else {
      // Fallback: try to sync if not found
      await this.syncOperatorsFromSheets();
      const retrySnap = await getDoc(docRef);
      return retrySnap.exists() ? (retrySnap.data() as Operator) : null;
    }
  }

  /**
   * Validates if a request is still valid based on current data.
   */
  async validateRequest(requestId: string): Promise<boolean> {
    const docRef = doc(db, 'requests', requestId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return false;

    const data = docSnap.data() as ShiftRequest;
    return data.status === 'OPEN';
  }
}
