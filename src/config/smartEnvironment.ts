/**
 * @file smartEnvironment.ts
 * @description Type-safe environment variable management with runtime validation
 * @author Nurse Hub Team
 * @created 2026-02-12
 * @modified 2026-02-12
 * @example
 * // Usage in services
 * import { smartEnv } from '@/config/smartEnvironment';
 *
 * const apiKey = smartEnv.getRequiredEnv('VITE_FIREBASE_API_KEY');
 * const debug = smartEnv.getOptionalEnv('VITE_DEBUG_MODE', 'false');
 * @notes
 * - Centralizes all environment variable access
 * - Fails fast at startup if critical vars missing
 * - Better error messages than raw import.meta.env
 * - Type-safe access to configuration
 * @dependencies
 * - Vite (import.meta.env)
 */

/**
 * Smart environment variable manager
 * Provides type-safe access to environment variables with validation
 */
class SmartEnvironment {
  /**
   * Gets a required environment variable
   * Throws error if not found
   *
   * @param key - Environment variable key (e.g., 'VITE_FIREBASE_API_KEY')
   * @returns Environment variable value
   * @throws {Error} If environment variable is not defined or empty
   *
   * @example
   * ```typescript
   * const apiKey = smartEnv.getRequiredEnv('VITE_FIREBASE_API_KEY');
   * // Throws if VITE_FIREBASE_API_KEY is missing
   * ```
   */
  getRequiredEnv(key: string): string {
    const value = import.meta.env[key];

    if (!value || value === '') {
      throw new Error(
        `❌ CRITICAL: Required environment variable "${key}" is not defined!\n` +
          `Please check your .env file and ensure "${key}" is set.\n` +
          `For Firebase config, check: https://console.firebase.google.com`,
      );
    }

    return value as string;
  } /*end getRequiredEnv*/

  /**
   * Gets an optional environment variable with default fallback
   *
   * @param key - Environment variable key
   * @param defaultValue - Default value if not found
   * @returns Environment variable value or default
   *
   * @example
   * ```typescript
   * const debug = smartEnv.getOptionalEnv('VITE_DEBUG_MODE', 'false');
   * // Returns 'false' if VITE_DEBUG_MODE is not set
   * ```
   */
  getOptionalEnv(key: string, defaultValue: string): string {
    const value = import.meta.env[key];
    return value && value !== '' ? (value as string) : defaultValue;
  } /*end getOptionalEnv*/

  /**
   * Validates all required Firebase environment variables
   * Should be called at app startup
   *
   * @throws {Error} If any required Firebase var is missing
   *
   * @remarks
   * Called automatically in boot/firebase.ts
   * Ensures Firebase config is complete before initialization
   */
  validateFirebaseEnv(): void {
    const requiredVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ];

    const missing: string[] = [];

    for (const varName of requiredVars) {
      try {
        this.getRequiredEnv(varName);
      } catch {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `❌ Firebase configuration incomplete!\n` +
          `Missing environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\n` +
          `Please check your .env file.`,
      );
    }
  } /*end validateFirebaseEnv*/

  /**
   * Gets Firebase configuration object
   * Validates all required vars before returning
   *
   * @returns Firebase config object ready for initializeApp()
   * @throws {Error} If any Firebase var is missing
   */
  getFirebaseConfig() {
    this.validateFirebaseEnv();

    return {
      apiKey: this.getRequiredEnv('VITE_FIREBASE_API_KEY'),
      authDomain: this.getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: this.getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: this.getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: this.getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: this.getRequiredEnv('VITE_FIREBASE_APP_ID'),
    };
  } /*end getFirebaseConfig*/

  /**
   * Checks if running in development mode
   * @returns true if DEV mode, false if PROD
   */
  isDevelopment(): boolean {
    return import.meta.env.DEV === true;
  } /*end isDevelopment*/

  /**
   * Checks if running in production mode
   * @returns true if PROD mode, false if DEV
   */
  isProduction(): boolean {
    return import.meta.env.PROD === true;
  } /*end isProduction*/
} /*end SmartEnvironment*/

// Export singleton instance
export const smartEnv = new SmartEnvironment();
