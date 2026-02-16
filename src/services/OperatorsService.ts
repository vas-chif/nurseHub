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
}

export const operatorsService = new OperatorsService();
