/**
 * @file OperatorsService.ts
 * @description Service for managing operator profiles within specific system configurations.
 * @author Nurse Hub Team
 * @created 2026-03-10
 * @modified 2026-05-07
 * @notes
 * - Accesses operators stored in sub-collections of the systemConfigurations collection.
 * - Supports retrieval of all operators for a config or specific operator by ID.
 * - Essential for mapping users to their professional shift schedules.
 * - findOperatorByName() provides fallback lookup for self-healing login flows.
 */
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { Operator } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

/**
 * Service for accessing operators from sub-collections under systemConfigurations
 */
export class OperatorsService {
  /**
   * Get all operators for a specific configuration
   */
  async getOperatorsByConfig(configId: string): Promise<Operator[]> {
    try {
      const operatorsRef = collection(db, 'systemConfigurations', configId, 'operators');
      const snapshot = await getDocs(operatorsRef);

      const operators = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Operator[];

      logger.info(`Loaded ${operators.length} operators for config ${configId}`);
      return operators;
    } catch (error) {
      logger.error('Failed to load operators by config', { configId, error });
      throw error;
    }
  }

  /**
   * Get a specific operator by ID from a configuration
   */
  async getOperatorById(configId: string, operatorId: string): Promise<Operator | null> {
    try {
      const operatorRef = doc(db, 'systemConfigurations', configId, 'operators', operatorId);
      const snapshot = await getDoc(operatorRef);

      if (!snapshot.exists()) {
        logger.warn('Operator not found', { configId, operatorId });
        return null;
      }

      return {
        id: snapshot.id,
        ...snapshot.data(),
      } as Operator;
    } catch (error) {
      logger.error('Failed to load operator by ID', { configId, operatorId, error });
      throw error;
    }
  }

  /**
   * Get all operators (for backward compatibility, uses active config)
   * @deprecated Use getOperatorsByConfig instead
   */
  async getAllOperators(configId: string): Promise<Operator[]> {
    return this.getOperatorsByConfig(configId);
  }

  /**
   * Finds an operator by their full name (case-insensitive) within a configuration.
   * Used as fallback when a user's operatorId is stale or points to a non-existent document.
   * This supports the self-healing login flow in authStore.loadUserProfile().
   * @param configId - The system configuration ID to search in
   * @param fullName - The operator's full name in any case (e.g. "Vasile Chifeac" or "VASILE CHIFEAC")
   * @returns The matching Operator or null if not found
   */
  async findOperatorByName(configId: string, fullName: string): Promise<Operator | null> {
    const allOps = await this.getOperatorsByConfig(configId);
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-z0-9]/g, '') // strip non-alphanumeric
        .trim();

    const target = normalize(fullName);
    
    // 1. Direct match
    let match = allOps.find((op) => normalize(op.name) === target);
    if (match) return match;

    // 2. Reversed name order match (e.g. "Chifeac Vasile" vs "Vasile Chifeac")
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const reversed = normalize(parts.reverse().join(' '));
      match = allOps.find((op) => normalize(op.name) === reversed);
    }

    return match ?? null;
  } /*end findOperatorByName*/
}

export const operatorsService = new OperatorsService();
