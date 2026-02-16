/**
 * @file secureLogger.ts
 * @description GDPR-compliant logger with automatic PII redaction
 * @author Nurse Hub Team
 * @created 2026-02-12
 * @modified 2026-02-12
 * @example
 * // Usage in components/services
 * import { useSecureLogger } from 'src/utils/secureLogger';
 *
 * const logger = useSecureLogger();
 * logger.info("User logged in", { userId: user.uid });
 * logger.error("Registration failed", error);
 * @notes
 * - Implements GDPR Art. 32 (data security requirements)
 * - Auto-redacts PII: email, phone, dateOfBirth, uid, password
 * - Different modes: development (console) vs production (structured)
 * - NO console.log should be used directly in codebase
 * @dependencies
 * - smartEnvironment (for dev/prod detection)
 */

import { smartEnv } from 'src/config/smartEnvironment';

/**
 * Log levels (ascending severity)
 */
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * PII-sensitive field names that should be redacted
 */
const PII_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'dateOfBirth',
  'dob',
  'fiscalCode',
  'taxCode',
  'password',
  'passwordConfirm',
  'confirmPassword',
  'uid', // Firebase UID (optional redaction)
  'ssn',
  'socialSecurityNumber',
];

/**
 * Secure logger class with PII redaction
 */
class SecureLogger {
  private isDev: boolean;

  constructor() {
    this.isDev = smartEnv.isDevelopment();
  } /*end constructor*/

  /**
   * Redacts PII from an object (deep copy)
   *
   * @param data - Object to redact PII from
   * @returns New object with PII fields redacted
   *
   * @remarks
   * Creates deep copy to avoid mutating original object
   * Recursively redacts nested objects and arrays
   */
  private redactPII(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactPII(item));
    }

    const redacted: Record<string, unknown> = {};
    const obj = data as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
      // Check if field should be redacted
      if (PII_FIELDS.includes(key.toLowerCase())) {
        redacted[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects
        redacted[key] = this.redactPII(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  } /*end redactPII*/

  /**
   * Formats log message for output
   *
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   * @returns Formatted log object
   */
  private formatLog(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();

    return {
      timestamp,
      level,
      message,
      ...(data !== undefined && { data: this.redactPII(data) }),
    };
  } /*end formatLog*/

  /**
   * Outputs log to console (development) or structured format (production)
   *
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data to log
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    const logEntry = this.formatLog(level, message, data);

    if (this.isDev) {
      // Development: Pretty console output
      const styles = {
        DEBUG: 'color: #888',
        INFO: 'color: #0066cc',
        WARN: 'color: #ff9800',
        ERROR: 'color: #f44336',
      };

      console.log(
        `%c[${logEntry.level}] ${logEntry.message}`,
        styles[level],
        logEntry.data !== undefined ? logEntry.data : '',
      );
    } else {
      // Production: Structured JSON logging
      // In futuro: inviare a servizio logging (Firestore, CloudWatch, etc.)
      console.log(JSON.stringify(logEntry));
    }
  } /*end log*/

  /**
   * Debug level log (only in development)
   *
   * @param message - Log message
   * @param data - Optional data to log
   *
   * @example
   * ```typescript
   * logger.debug("Cache hit", { key: cacheKey });
   * ```
   */
  debug(message: string, data?: unknown): void {
    if (this.isDev) {
      this.log('DEBUG', message, data);
    }
  } /*end debug*/

  /**
   * Info level log
   *
   * @param message - Log message
   * @param data - Optional data to log
   *
   * @example
   * ```typescript
   * logger.info("User logged in", { userId: user.uid });
   * ```
   */
  info(message: string, data?: unknown): void {
    this.log('INFO', message, data);
  } /*end info*/

  /**
   * Warning level log
   *
   * @param message - Log message
   * @param data - Optional data to log
   *
   * @example
   * ```typescript
   * logger.warn("Cache miss", { key: cacheKey });
   * ```
   */
  warn(message: string, data?: unknown): void {
    this.log('WARN', message, data);
  } /*end warn*/

  /**
   * Error level log
   *
   * @param message - Log message
   * @param error - Error object or data
   *
   * @example
   * ```typescript
   * logger.error("Registration failed", error);
   * ```
   */
  error(message: string, error?: unknown): void {
    // Extract error message if Error object
    const errorData =
      error instanceof Error ? { message: error.message, stack: error.stack } : error;

    this.log('ERROR', message, errorData);
  } /*end error*/
} /*end SecureLogger*/

// Singleton instance
let loggerInstance: SecureLogger | null = null;

/**
 * Gets or creates secure logger instance
 *
 * @returns SecureLogger instance
 *
 * @example
 * ```typescript
 * const logger = useSecureLogger();
 * logger.info("Operation complete");
 * ```
 */
export const useSecureLogger = (): SecureLogger => {
  if (!loggerInstance) {
    loggerInstance = new SecureLogger();
  }
  return loggerInstance;
}; /*end useSecureLogger*/
