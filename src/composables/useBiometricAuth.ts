/**
 * @file useBiometricAuth.ts
 * @description Composable for biometric app-lock on native Android (Phase 38, P6).
 *   Verifies the device user's identity on top of an existing Firebase persistent session.
 *   No credentials are ever stored — GDPR Art. 32 / §1.5 compliant.
 * @author Nurse Hub Team
 * @created 2026-05-15
 * @modified 2026-05-15
 * @notes
 * - App-lock pattern: biometric locks the UI on app launch; Firebase handles server auth.
 * - Opt-in preference is a boolean flag in localStorage — not a credential (§1.5 GDPR).
 * - sessionUnlocked flag prevents re-prompting when MainLayout re-mounts in the same session.
 * - Only active on native Android (Capacitor.isNativePlatform()).
 * @dependencies
 * - @aparajita/capacitor-biometric-auth@^9.0.0 (peerDep: @capacitor/core >=6.1.0 — Capacitor 7 compat)
 * - @capacitor/core
 */
import { Capacitor } from '@capacitor/core';
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
} from '@aparajita/capacitor-biometric-auth';
import { useSecureLogger } from 'src/utils/secureLogger';

const BIOMETRIC_KEY = 'nursehub_biometric_opt_in';

/** Module-level flag: cleared on hard reload (app restart), persists across soft re-mounts. */
let sessionUnlocked = false;

export function useBiometricAuth() {
  const logger = useSecureLogger();

  /** Returns true if the user opted in to biometric app-lock. */
  function isOptedIn(): boolean {
    return localStorage.getItem(BIOMETRIC_KEY) === 'true';
  }

  /**
   * Returns true if the user has never been shown the biometric opt-in dialog.
   * A null value means the preference has never been set (neither accepted nor declined).
   */
  function hasBeenAsked(): boolean {
    return localStorage.getItem(BIOMETRIC_KEY) !== null;
  }

  /**
   * Set biometric opt-in preference.
   * Both true and false mark the dialog as "seen" (it will not appear again).
   */
  function setOptIn(value: boolean): void {
    localStorage.setItem(BIOMETRIC_KEY, value ? 'true' : 'false');
  }

  /** Returns true if biometric unlock has already been performed this app session. */
  function isSessionUnlocked(): boolean {
    return sessionUnlocked;
  }

  /** Mark this session as biometrically unlocked (prevents re-prompting on layout re-mount). */
  function setSessionUnlocked(): void {
    sessionUnlocked = true;
  }

  /** Returns true if the device has biometry enrolled and available for use by apps. */
  async function isBiometricAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } catch (err: unknown) {
      logger.warn('BiometricAuth.checkBiometry error', err);
      return false;
    }
  }

  /**
   * Triggers the native biometric (or device PIN) prompt.
   * @returns true on success; false on cancel, failure, or non-native platform.
   */
  async function authenticate(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      await BiometricAuth.authenticate({
        reason: 'Conferma la tua identità per accedere a NurseHub',
        cancelTitle: 'Annulla',
        allowDeviceCredential: true,
        androidTitle: 'NurseHub',
        androidSubtitle: 'Usa biometria o PIN del dispositivo',
        androidConfirmationRequired: false,
      });
      logger.info('Biometric authentication successful');
      return true;
    } catch (error: unknown) {
      if (error instanceof BiometryError) {
        const silent =
          error.code === BiometryErrorType.userCancel ||
          error.code === BiometryErrorType.systemCancel;
        if (!silent) logger.warn('Biometric auth failed', { code: error.code });
      }
      return false;
    }
  }

  return {
    isOptedIn,
    hasBeenAsked,
    setOptIn,
    isSessionUnlocked,
    setSessionUnlocked,
    isBiometricAvailable,
    authenticate,
  };
}
