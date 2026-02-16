/**
 * @file firestoreLogger.ts
 * @description Centralized Firestore operation logging and cost tracking
 * @author Nurse Hub Team
 * @created 2026-02-12
 * @modified 2026-02-12
 * @example
 * // Usage in services
 * import { firestoreLogger } from 'src/utils/firestoreLogger';
 *
 * const ctx = firestoreLogger.startOperation('users', 'read');
 * try {
 *   const doc = await getDoc(userRef);
 *   firestoreLogger.success(ctx);
 * } catch (error) {
 *   firestoreLogger.error(ctx, error);
 * }
 * @notes
 * - Tracks all Firestore operations (read, write, delete)
 * - Monitors performance (operation duration)
 * - Cost estimation (reads × €0.00006)
 * - GDPR Art. 30 compliance (audit logging)
 * @dependencies
 * - secureLogger (for logging output)
 */

import { useSecureLogger } from './secureLogger';

/**
 * Firestore operation types
 */
type FirestoreOperation = 'read' | 'write' | 'delete' | 'query';

/**
 * Operation context for tracking
 */
interface OperationContext {
  collection: string;
  operation: FirestoreOperation;
  startTime: number;
  operationId: string;
}

/**
 * Firestore logger class for operation tracking
 */
class FirestoreLogger {
  private logger = useSecureLogger();
  private operationCounter = 0;
  private monthlyReads = 0;
  private monthlyWrites = 0;

  // Cost constants (Firebase pricing)
  private readonly READ_COST = 0.00006; // €0.00006 per read (Europe)
  private readonly WRITE_COST = 0.00018; // €0.00018 per write (Europe)

  /**
   * Starts tracking a Firestore operation
   *
   * @param collection - Firestore collection name
   * @param operation - Type of operation
   * @returns Operation context for completion tracking
   *
   * @example
   * ```typescript
   * const ctx = firestoreLogger.startOperation('users', 'read');
   * // ... perform operation ...
   * firestoreLogger.success(ctx);
   * ```
   */
  startOperation(collection: string, operation: FirestoreOperation): OperationContext {
    this.operationCounter++;

    const context: OperationContext = {
      collection,
      operation,
      startTime: Date.now(),
      operationId: `${collection}_${operation}_${this.operationCounter}`,
    };

    this.logger.debug(`Firestore ${operation} starting`, {
      collection,
      operationId: context.operationId,
    });

    return context;
  } /*end startOperation*/

  /**
   * Logs successful operation completion
   *
   * @param context - Operation context from startOperation()
   * @param documentCount - Number of documents affected (default: 1)
   *
   * @remarks
   * Tracks operation duration and updates cost counters
   */
  success(context: OperationContext, documentCount = 1): void {
    const duration = Date.now() - context.startTime;

    // Update cost counters
    if (context.operation === 'read' || context.operation === 'query') {
      this.monthlyReads += documentCount;
    } else if (context.operation === 'write') {
      this.monthlyWrites += documentCount;
    }

    this.logger.info(`Firestore ${context.operation} success`, {
      collection: context.collection,
      operationId: context.operationId,
      duration: `${duration}ms`,
      documents: documentCount,
      estimatedCost: this.calculateOperationCost(context.operation, documentCount),
    });
  } /*end success*/

  /**
   * Logs failed operation
   *
   * @param context - Operation context from startOperation()
   * @param error - Error that occurred
   *
   * @remarks
   * Failed operations still count as reads/writes for billing!
   */
  error(context: OperationContext, error: unknown): void {
    const duration = Date.now() - context.startTime;

    this.logger.error(`Firestore ${context.operation} failed`, {
      collection: context.collection,
      operationId: context.operationId,
      duration: `${duration}ms`,
      error,
    });
  } /*end error*/

  /**
   * Calculates cost for an operation
   *
   * @param operation - Operation type
   * @param documentCount - Number of documents
   * @returns Estimated cost in EUR
   */
  private calculateOperationCost(operation: FirestoreOperation, documentCount: number): string {
    let cost = 0;

    if (operation === 'read' || operation === 'query') {
      cost = documentCount * this.READ_COST;
    } else if (operation === 'write') {
      cost = documentCount * this.WRITE_COST;
    }

    return `€${cost.toFixed(6)}`;
  } /*end calculateOperationCost*/

  /**
   * Gets monthly cost summary
   *
   * @returns Monthly cost breakdown
   *
   * @example
   * ```typescript
   * const summary = firestoreLogger.getMonthlySummary();
   * console.log(`Reads: ${summary.reads}, Cost: ${summary.totalCost}`);
   * ```
   */
  getMonthlySummary() {
    const readCost = this.monthlyReads * this.READ_COST;
    const writeCost = this.monthlyWrites * this.WRITE_COST;
    const totalCost = readCost + writeCost;

    return {
      reads: this.monthlyReads,
      writes: this.monthlyWrites,
      readCost: `€${readCost.toFixed(2)}`,
      writeCost: `€${writeCost.toFixed(2)}`,
      totalCost: `€${totalCost.toFixed(2)}`,
    };
  } /*end getMonthlySummary*/

  /**
   * Resets monthly counters
   * Should be called at start of each month
   */
  resetMonthlyCounters(): void {
    this.logger.info('Resetting Firestore monthly counters', {
      previousSummary: this.getMonthlySummary(),
    });

    this.monthlyReads = 0;
    this.monthlyWrites = 0;
  } /*end resetMonthlyCounters*/
} /*end FirestoreLogger*/

// Export singleton instance
export const firestoreLogger = new FirestoreLogger();
