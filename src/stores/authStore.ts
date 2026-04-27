/**
 * @file authStore.ts
 * @description Pinia store for authentication state and user management.
 * @author Nurse Hub Team
 * @created 2026-02-11
 * @modified 2026-04-20
 * @notes
 * - Phase 25: JWT-First Authorization (§1.10). Role is read from Custom Claims.
 * - Firestore `role` field kept as backup/audit trail.
 * - isAdmin computed: JWT claim (primary) > Firestore field (fallback).
 * - After role change: getIdToken(true) forces immediate JWT refresh.
 * @dependencies
 * - firebase/auth
 * - src/services/UserService.ts
 * - src/services/OperatorsService.ts
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, Operator } from '../types/models';
import { userService } from '../services/UserService';
import { operatorsService } from '../services/OperatorsService';
import type { UserRole, IUserPermissions } from '../types/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../boot/firebase';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null);
  const currentOperator = ref<Operator | null>(null);
  const selectedOperatorIds = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);

  const authUser = ref<FirebaseUser | null>(null);

  /**
   * Phase 25 (§1.10): Role from JWT Custom Claim.
   * Populated after getIdTokenResult() on auth state change.
   * Primary source for isAdmin computed.
   */
  const claimRole = ref<UserRole | null>(null);
  const managedConfigIds = ref<string[]>([]);
  const permissions = ref<IUserPermissions>({
    manageAdmins: false,
    manageSystem: false,
    viewAuditLogs: false
  });

  // --- Computed ---

  const isAuthenticated = computed(() => authUser.value !== null);

  /**
   * Phase 25 (§1.10): JWT-First — claim is primary, Firestore role is fallback.
   * This guarantees immediate reflection of role changes after token refresh.
   */
  const userRole = computed((): UserRole => {
    // Primary: JWT Custom Claim
    if (claimRole.value !== null) return claimRole.value;
    // Fallback: Firestore document
    return currentUser.value?.role ?? 'user';
  });

  const isSuperAdmin = computed(() => userRole.value === 'superAdmin');
  const isAdmin = computed(() => userRole.value === 'admin');
  const isAnyAdmin = computed(() => isSuperAdmin.value || isAdmin.value);
  const isVerified = computed(() => currentUser.value?.isVerified || false);

  /**
   * Check if user can manage a specific configuration
   */
  const canManageConfig = computed(() => (configId: string) => {
    if (isSuperAdmin.value) return true;
    if (!isAdmin.value) return false;
    return managedConfigIds.value.includes(configId);
  });

  const canManageAdmins = computed(() => isSuperAdmin.value || (isAdmin.value && permissions.value.manageAdmins));
  const canManageSystem = computed(() => isSuperAdmin.value || (isAdmin.value && permissions.value.manageSystem));

  // --- Private helpers ---

  /**
   * Reads the JWT ID token and extracts the `role` Custom Claim.
   * Falls back gracefully if getIdTokenResult fails.
   */
  async function refreshClaimRole(firebaseUser: FirebaseUser): Promise<void> {
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      const claims = tokenResult.claims;
      
      const roleClaim = claims['role'] as UserRole;
      if (roleClaim === 'superAdmin' || roleClaim === 'admin' || roleClaim === 'user') {
        claimRole.value = roleClaim;
      } else {
        claimRole.value = null;
      }

      managedConfigIds.value = (claims['managedConfigIds'] as string[]) || [];
      
      const permsClaim = claims['permissions'] as IUserPermissions | undefined;
      if (permsClaim) {
        permissions.value = {
          manageAdmins: !!permsClaim.manageAdmins,
          manageSystem: !!permsClaim.manageSystem,
          viewAuditLogs: !!permsClaim.viewAuditLogs
        };
      } else {
        permissions.value = { manageAdmins: false, manageSystem: false, viewAuditLogs: false };
      }

      logger.info('JWT claims loaded', { 
        role: claimRole.value ?? 'fallback', 
        configs: managedConfigIds.value.length,
        canManageAdmins: permissions.value.manageAdmins
      });
    } catch (err) {
      logger.warn('Failed to read JWT claims', err);
      claimRole.value = null;
      managedConfigIds.value = [];
    }
  }

  // --- Actions ---

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      // Phase 25: Load JWT claim immediately on login
      await refreshClaimRole(userCredential.user);
      await loadUserProfile(userCredential.user.uid);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function resetPassword(email: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
  ): Promise<{ needsApproval: boolean }> {
    loading.value = true;
    error.value = null;

    try {
      logger.info('Starting registration', { email });

      // FORCE sign out any existing user to prevent auth conflicts
      try {
        await signOut(auth);
      } catch {
        // Ignore errors if no user was signed in
      }

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      logger.info('Firebase Auth account created', { uid: userCredential.user.uid });

      // Send verification email
      await sendEmailVerification(userCredential.user);
      logger.info('Verification email sent');

      // Wait for auth state to propagate (500ms)
      await new Promise((resolve) => setTimeout(resolve, 500));

      logger.info('Creating Firestore user document');

      // Create Firestore user document (role: 'user' — no claim written yet, happens via migrate or first role change)
      const result = await userService.createUserDocument(
        userCredential.user.uid,
        email,
        firstName,
        lastName,
        dateOfBirth,
      );

      logger.info('User document created', {
        operatorId: result.operatorId,
        needsApproval: result.needsApproval,
      });

      await loadUserProfile(userCredential.user.uid);
      return { needsApproval: result.needsApproval };
    } catch (err) {
      error.value = (err as Error).message;
      logger.error('Registration failed', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    loading.value = true;
    try {
      await signOut(auth);
      authUser.value = null;
      currentUser.value = null;
      claimRole.value = null;
      
      // Clear other caches
      const { useScheduleStore } = await import('./scheduleStore');
      useScheduleStore().clearCache();
    } catch (err) {
      error.value = (err as Error).message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function loadUserProfile(uid: string): Promise<void> {
    try {
      const user = await userService.getUserDocument(uid);
      if (user) {
        currentUser.value = user;

        if (user.isVerified && user.operatorId && user.configId) {
          const operator = await operatorsService.getOperatorById(user.configId, user.operatorId);
          if (operator) {
            currentOperator.value = operator;
          }
        }
      }
    } catch (err) {
      logger.error('Error loading user profile', err);
      error.value = (err as Error).message;
    }
  }

  /**
   * Phase 25 (§1.10): Forces a JWT refresh after an admin role change.
   * Must be called by UserService after /api/update-role succeeds.
   */
  async function forceTokenRefresh(): Promise<void> {
    if (!authUser.value) return;
    try {
      // Force Firebase to fetch a fresh JWT with updated claims
      await authUser.value.getIdToken(true);
      await refreshClaimRole(authUser.value);
      logger.info('JWT token refreshed, new claim role:', { role: claimRole.value });
    } catch (err) {
      logger.error('Failed to force token refresh', err);
    }
  }

  function setSelectedOperators(operatorIds: string[]): void {
    selectedOperatorIds.value = operatorIds;
  }

  function init(): Promise<void> {
    if (isInitialized.value) return Promise.resolve();

    return new Promise((resolve) => {
      onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        authUser.value = firebaseUser;
        if (firebaseUser) {
          // Phase 25: Read JWT claim before loading Firestore profile
          void refreshClaimRole(firebaseUser)
            .then(() => loadUserProfile(firebaseUser.uid))
            .catch((err) => logger.error('Error during auth initialization', err))
            .finally(() => {
              isInitialized.value = true;
              resolve();
            });
        } else {
          currentUser.value = null;
          currentOperator.value = null;
          selectedOperatorIds.value = [];
          claimRole.value = null;
          isInitialized.value = true;
          resolve();
        }
      });
    });
  }

  return {
    // State
    authUser,
    currentUser,
    currentOperator,
    selectedOperatorIds,
    loading,
    isInitialized,
    claimRole,
    managedConfigIds,
    permissions,
    // Computed
    isAuthenticated,
    userRole,
    isAdmin,
    isSuperAdmin,
    isAnyAdmin,
    isVerified,
    canManageConfig,
    canManageAdmins,
    canManageSystem,
    // Actions
    login,
    register,
    resetPassword,
    logout,
    loadUserProfile,
    setSelectedOperators,
    forceTokenRefresh,
    init,
  };
});
