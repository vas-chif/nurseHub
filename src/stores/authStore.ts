/**
 * @file authStore.ts
 * @description Pinia store for authentication state and user management
 * @author Nurse Hub Team
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, Operator } from '../types/models';
import { userService } from '../services/UserService';
import { operatorsService } from '../services/OperatorsService';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification,
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

  // Computed
  const isAuthenticated = computed(() => currentUser.value !== null);
  const userRole = computed(() => currentUser.value?.role || 'user');
  const isAdmin = computed(() => userRole.value === 'admin');
  const isVerified = computed(() => currentUser.value?.isVerified || false);

  // Actions
  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        throw new Error('EMAIL_NOT_VERIFIED');
      }

      await loadUserProfile(userCredential.user.uid);
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
        logger.info('Signed out any existing user');
      } catch {
        // Ignore errors if no user was signed in
      }

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      logger.info('Firebase Auth account created', { uid: userCredential.user.uid });

      // Send verification email
      await sendEmailVerification(userCredential.user);
      logger.info('Verification email sent');

      // Wait for auth state to propagate to Firestore client (500ms)
      // This ensures request.auth is populated when creating document
      await new Promise((resolve) => setTimeout(resolve, 500));

      logger.info('Creating Firestore user document');

      // Create Firestore user document with operator matching
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

      // Load the newly created user profile
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
      currentUser.value = null;
      currentOperator.value = null;
      selectedOperatorIds.value = [];
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

        // If user is verified and linked to an operator, load operator data
        if (user.isVerified && user.operatorId && user.configId) {
          const operator = await operatorsService.getOperatorById(user.configId, user.operatorId);
          if (operator) {
            currentOperator.value = operator;
          }
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      error.value = (err as Error).message;
    }
  }

  function setSelectedOperators(operatorIds: string[]): void {
    selectedOperatorIds.value = operatorIds;
  }

  // Initialize auth state listener and wait for first state
  function init(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          void loadUserProfile(firebaseUser.uid).finally(() => resolve());
        } else {
          currentUser.value = null;
          currentOperator.value = null;
          selectedOperatorIds.value = [];
          resolve();
        }
      });
    });
  }

  return {
    // State
    currentUser,
    currentOperator,
    selectedOperatorIds,
    loading,
    error,
    // Computed
    isAuthenticated,
    userRole,
    isAdmin,
    isVerified,
    // Actions
    login,
    register,
    logout,
    loadUserProfile,
    setSelectedOperators,
    init,
  };
});
