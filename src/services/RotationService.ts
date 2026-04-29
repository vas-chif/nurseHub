/**
 * @file RotationService.ts
 * @description Service for managing shift rotation groups and timer state in Firestore.
 * @author Nurse Hub Team
 * @created 2026-04-29
 * @modified 2026-04-29
 * @notes
 * - Handles creation, update, and retrieval of RotationGroup documents.
 * - Sub-collection of systemConfigurations.
 * @dependencies
 * - Firebase Firestore
 * - src/types/models
 */
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { RotationGroup } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export class RotationService {
  /**
   * Get all rotation groups for a specific configuration
   */
  async getGroups(configId: string): Promise<RotationGroup[]> {
    try {
      const q = query(collection(db, `systemConfigurations/${configId}/rotationGroups`));
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data() as RotationGroup);
    } catch (e) {
      logger.error('Failed to fetch rotation groups', e);
      throw e;
    }
  }

  /**
   * Create or update a rotation group
   */
  async saveGroup(configId: string, group: RotationGroup): Promise<void> {
    try {
      group.updatedAt = Date.now();
      const ref = doc(db, `systemConfigurations/${configId}/rotationGroups`, group.id);
      await setDoc(ref, group);
      logger.info('Rotation group saved successfully', { groupId: group.id });
    } catch (e) {
      logger.error('Failed to save rotation group', e);
      throw e;
    }
  }

  /**
   * Delete a rotation group
   */
  async deleteGroup(configId: string, groupId: string): Promise<void> {
    try {
      const ref = doc(db, `systemConfigurations/${configId}/rotationGroups`, groupId);
      await deleteDoc(ref);
      logger.info('Rotation group deleted', { groupId });
    } catch (e) {
      logger.error('Failed to delete rotation group', e);
      throw e;
    }
  }

  /**
   * Update the timer state (Pause/Resume/Set Next)
   */
  async updateTimerState(
    configId: string,
    groupId: string,
    isActive: boolean,
    currentColumnIndex: number,
    nextChangeTimestamp: number | null
  ): Promise<void> {
    try {
      const ref = doc(db, `systemConfigurations/${configId}/rotationGroups`, groupId);
      await updateDoc(ref, {
        isActive,
        currentColumnIndex,
        nextChangeTimestamp,
        updatedAt: Date.now()
      });
      logger.info('Rotation group timer updated', { groupId, isActive, nextChangeTimestamp });
    } catch (e) {
      logger.error('Failed to update rotation timer', e);
      throw e;
    }
  }
}

export const rotationService = new RotationService();
