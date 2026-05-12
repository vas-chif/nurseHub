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
    nextChangeTimestamp: number | null,
    intervalDays?: number,
  ): Promise<void> {
    try {
      const ref = doc(db, `systemConfigurations/${configId}/rotationGroups`, groupId);
      const payload: Record<string, number | boolean | null> = {
        isActive,
        currentColumnIndex,
        nextChangeTimestamp,
        updatedAt: Date.now(),
      };
      if (intervalDays !== undefined) payload['intervalDays'] = intervalDays;
      await updateDoc(ref, payload);
      logger.info('Rotation group timer updated', { groupId, isActive, nextChangeTimestamp });
    } catch (e) {
      logger.error('Failed to update rotation timer', e);
      throw e;
    }
  }

  /**
   * Phase 36: Clock Guard — Advance the rotation by one step and schedule the next.
   *
   * Uses `group.nextChangeTimestamp` as the base for the next timestamp to prevent
   * time-drift: if the app is opened 2h late, the cadence stays anchored to the
   * original scheduled time (e.g. always 14:00) rather than shifting forward.
   *
   * @param configId - Active config ID
   * @param group    - The rotation group to advance
   */
  async advanceGroup(configId: string, group: RotationGroup): Promise<void> {
    const totalCols = group.operators[0]?.pattern.length || 18;
    const nextIndex = advance(group.currentColumnIndex, totalCols);
    const days = group.intervalDays ?? 5;
    // Anchor next timestamp to the scheduled base, not to Date.now() (avoids drift)
    const baseTs = group.nextChangeTimestamp ?? Date.now();
    const nextTs = baseTs + days * 24 * 60 * 60 * 1000;

    try {
      await this.updateTimerState(configId, group.id, true, nextIndex, nextTs);
      logger.info('Rotation advanced', { groupId: group.id, nextIndex, nextTs: new Date(nextTs).toISOString() });
    } catch (e) {
      logger.error('Failed to advance rotation group', e);
      throw e;
    }
  } /*end advanceGroup*/
}

export const rotationService = new RotationService();

/**
 * Pure helper: returns the next column index for a rotation group.
 * Wraps around when the end of the pattern is reached.
 *
 * @param currentIndex - The current 0-based column index
 * @param totalCols - Total number of columns in the rotation pattern
 * @returns The next 0-based column index
 */
export function advance(currentIndex: number, totalCols: number): number {
  if (totalCols <= 0) return 0;
  return (currentIndex + 1) % totalCols;
} /*end advance*/
