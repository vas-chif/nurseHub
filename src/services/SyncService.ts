/**
 * @file SyncService.ts
 * @description Handles synchronization between Google Sheets (Source of Truth) and Firestore (Operational DB)
 * @author Nurse Hub Team
 */
import { collection, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { GoogleSheetsService } from './GoogleSheetsService';
import type { ShiftRequest } from '../types/models';
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
   * @param configId - The system configuration ID to sync to
   */
  async syncOperatorsFromSheets(configId: string): Promise<void> {
    try {
      console.log(`Starting sync from Sheets to config ${configId}...`);
      const operators = await this.sheetsService.fetchOperators();

      const batch = writeBatch(db);
      // Write to sub-collection: systemConfigurations/{configId}/operators
      const operatorsRef = collection(db, 'systemConfigurations', configId, 'operators');

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
      console.log(`Synced ${operators.length} operators to config ${configId}.`);
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves an operator by ID from Firestore.
   * @deprecated Use OperatorsService.getOperatorById(configId, operatorId) instead
   */
  getOperator(): null {
    // This method is now deprecated - operators are in sub-collections
    // Use OperatorsService.getOperatorById() instead
    console.warn('getOperator is deprecated. Use OperatorsService.getOperatorById() instead.');
    return null;
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
