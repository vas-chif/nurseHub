/**
 * @file UserService.ts
 * @description Manages Firebase Auth users and their Firestore documents with operator linking
 * @author Nurse Hub Team
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { User } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

export class UserService {
  // Use getters to ensure db is initialized before accessing collections
  private get usersCollection() {
    return collection(db, 'users');
  }

  private get operatorsCollection() {
    return collection(db, 'operators');
  }

  /**
   * Creates a new user document in Firestore with automatic operator matching,
   * linking to an existing operator if email and DOB match, or marking for
   * admin approval otherwise.
   */
  async createUserDocument(
    uid: string,
    email: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
  ): Promise<{ operatorId: string | null; needsApproval: boolean }> {
    // Search for operator with matching email
    let snapshot;
    try {
      logger.debug('Searching for operator match', { email });
      const operatorQuery = query(this.operatorsCollection, where('email', '==', email));
      snapshot = await getDocs(operatorQuery);
      logger.debug('Operator search successful', { count: snapshot.size });
    } catch (err: unknown) {
      logger.warn('Could not query operators for matching', { error: err });
      // Continue without operator matching if read fails
      snapshot = { empty: true, docs: [] };
    }

    let operatorId: string | null = null;
    let isVerified = false;
    let pendingApproval = false;

    if (!snapshot.empty) {
      // Email match found
      const operatorDoc = snapshot.docs[0];

      if (!operatorDoc) {
        // Document missing - needs admin verification
        pendingApproval = true;
      } else {
        const operatorData = operatorDoc.data();

        if (!operatorData) {
          // Data missing - needs admin verification
          pendingApproval = true;
        } else {
          // Verify date of birth if available in operator record
          if (operatorData.dateOfBirth) {
            if (operatorData.dateOfBirth === dateOfBirth) {
              // Perfect match: email + DOB
              operatorId = operatorDoc.id;
              isVerified = true;
            } else {
              // Email matches but DOB doesn't - needs admin verification
              pendingApproval = true;
            }
          } else {
            // No DOB in operator record - trust email match
            operatorId = operatorDoc.id;
            isVerified = true;
          }
        }
      }
    } else {
      // No email match - needs admin verification
      pendingApproval = true;
    }

    // Create user document
    const userDoc: Partial<User> = {
      uid,
      email,
      firstName,
      lastName,
      dateOfBirth,
      role: 'user',
      operatorId,
      isVerified,
      pendingApproval,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await setDoc(doc(this.usersCollection, uid), userDoc);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string; stack?: string; name?: string };
      logger.error('Registration errored', err);
      throw error;
    }

    return { operatorId, needsApproval: pendingApproval };
  }

  /**
   * Retrieves a user document by Firebase Auth UID
   */
  async getUserDocument(uid: string): Promise<User | null> {
    const userDoc = await getDoc(doc(this.usersCollection, uid));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    return null;
  }

  /**
   * Links a user to an operator (admin action)
   */
  async linkUserToOperator(uid: string, operatorId: string): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      operatorId,
      isVerified: true,
      pendingApproval: false,
      updatedAt: Date.now(),
    });
  }

  /**
   * Approves a user without linking to an operator (e.g. admin or standalone user)
   */
  async approveUser(uid: string): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      isVerified: true,
      pendingApproval: false,
      updatedAt: Date.now(),
    });
  }

  /**
   * Updates a user's role (admin action)
   */
  async updateUserRole(uid: string, newRole: 'user' | 'admin'): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      role: newRole,
      updatedAt: Date.now(),
    });
  }

  /**
   * Gets all users pending admin approval
   */
  async getPendingUsers(): Promise<User[]> {
    const q = query(this.usersCollection, where('pendingApproval', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * Gets all registered users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(this.usersCollection);
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * Unlinks a user from an operator (admin action for corrections)
   */
  async unlinkUserFromOperator(uid: string): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      operatorId: null,
      isVerified: false,
      pendingApproval: true,
      updatedAt: Date.now(),
    });
  }
  /**
   * Updates user profile data (e.g. avatarUrl)
   */
  /**
   * Updates user profile data (e.g. avatarUrl)
   */
  async updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      ...data,
      updatedAt: Date.now(),
    });
  }

  /**
   * Toggles the blocked status of a user
   */
  async toggleUserBlockStatus(uid: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(this.usersCollection, uid), {
      isBlocked: !currentStatus,
      updatedAt: Date.now(),
    });
  }
}

// Export singleton instance
export const userService = new UserService();
