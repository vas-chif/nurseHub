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
    // Create basic user document - NO operator search during registration
    // User will manually sync later via "Sincronizza" button
    logger.info('Creating basic user document', { email });

    const userDoc: Partial<User> = {
      uid,
      email,
      firstName,
      lastName,
      dateOfBirth,
      role: 'user', // Default system role
      // profession is undefined initially
      operatorId: null, // No operator assigned yet
      configId: null, // No configuration assigned yet
      isVerified: false, // Must verify email first
      pendingApproval: true, // Needs manual sync or admin approval
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

    logger.info('User document created', { uid });
    return { operatorId: null, needsApproval: true };
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
   * Syncs a user to an operator by searching all configurations
   * Called when user clicks "Sincronizza/Trova Operatore" button
   */
  async syncUserToOperator(uid: string): Promise<{
    success: boolean;
    operatorId: string | null;
    configId: string | null;
    profession: string | null;
    message: string;
  }> {
    try {
      // Get user document to retrieve registration data
      const userDoc = await this.getUserDocument(uid);
      if (!userDoc) {
        return {
          success: false,
          operatorId: null,
          configId: null,
          profession: null,
          message: 'Utente non trovato nel database',
        };
      }

      logger.info('Starting user sync to operator', {
        uid,
        email: userDoc.email,
        name: `${userDoc.firstName} ${userDoc.lastName}`,
      });

      const userEmail = userDoc.email.toLowerCase().trim();
      const userFirst = userDoc.firstName.toUpperCase().trim();
      const userLast = userDoc.lastName.toUpperCase().trim();
      const userDOB = userDoc.dateOfBirth;

      // Search all configurations for matching operator
      const configsSnapshot = await getDocs(collection(db, 'systemConfigurations'));
      logger.info(`Checking ${configsSnapshot.size} configurations...`);

      for (const configDoc of configsSnapshot.docs) {
        const configId = configDoc.id;
        const configData = configDoc.data();
        const configName = configData.name || 'Senza Nome';
        const profession = configData.profession || configData.role || 'Infermiere';

        logger.info(`Checking config: ${configName} (ID: ${configId})`);

        const operatorsRef = collection(db, 'systemConfigurations', configId, 'operators');
        const snapshot = await getDocs(operatorsRef);

        for (const operatorDoc of snapshot.docs) {
          const operatorData = operatorDoc.data();
          const opId = operatorDoc.id;
          const opName = String(operatorData.name || '').toUpperCase();
          const opEmail = String(operatorData.email || '')
            .toLowerCase()
            .trim();
          const opDOB = operatorData.dateOfBirth;

          // 1. Check Email Match
          const emailMatches = userEmail !== '' && opEmail === userEmail;

          // 2. Check Name Match (Case-insensitive, checks if both first and last name appear in opName)
          const namesMatch = opName.includes(userFirst) && opName.includes(userLast);

          // If either matches, we have a candidate
          if (emailMatches || namesMatch) {
            // 3. Verify Date of Birth if both records have it
            if (opDOB && userDOB && opDOB !== userDOB) {
              logger.warn('Candidate found but Date of Birth mismatch', {
                opId,
                configId,
                opDOB,
                userDOB,
              });
              continue;
            }

            // Match confirmed!
            logger.info('Match found!', {
              opId,
              configId,
              method: emailMatches ? 'email' : 'name',
              profession,
            });

            // Update user document
            await updateDoc(doc(this.usersCollection, uid), {
              operatorId: opId,
              configId: configId,
              profession,
              isVerified: true,
              pendingApproval: false,
              updatedAt: Date.now(),
            });

            // ALSO: Update operator document with userId for security rules
            await updateDoc(doc(db, 'systemConfigurations', configId, 'operators', opId), {
              userId: uid,
            });

            return {
              success: true,
              operatorId: opId,
              configId: configId,
              profession,
              message: `Operatore "${operatorData.name}" trovato in "${configName}" e associato con successo!`,
            };
          }
        }
      }

      // No operator found in any configuration
      logger.info('Sync completed: no matching operator found', { uid, email: userDoc.email });

      return {
        success: false,
        operatorId: null,
        configId: null,
        profession: null,
        message:
          "Nessun operatore corrispondente trovato nel sistema. Verifica che i dati (Email, Nome, Data di Nascita) siano identici a quelli nel foglio turni. In alternativa, attendi l'approvazione dell'amministratore.",
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('CRITICAL ERROR during syncUserToOperator', {
        uid,
        message: err.message,
        name: err.name,
        stack: err.stack,
      });

      return {
        success: false,
        operatorId: null,
        configId: null,
        profession: null,
        message: `Errore tecnico durante la sincronizzazione: ${err.message || 'Errore sconosciuto'}. Riprova più tardi.`,
      };
    }
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
   * Approves a user with configuration and operator selection (admin action)
   * Automatically assigns role from the selected configuration
   */
  async approveUserWithConfig(uid: string, configId: string, operatorId: string): Promise<void> {
    try {
      // Get configuration to retrieve role
      const configDoc = await getDoc(doc(db, 'systemConfigurations', configId));
      if (!configDoc.exists()) {
        throw new Error('Configuration not found');
      }

      const configData = configDoc.data();
      // NOTE: Mapping config.profession -> user.profession
      const profession = configData?.profession || configData?.role || 'Infermiere';

      logger.info('Approving user with config', { uid, configId, operatorId, profession });

      // Update user document with config, operator, and profession
      await updateDoc(doc(this.usersCollection, uid), {
        configId,
        operatorId,
        profession, // Set profession
        // role: DO NOT CHANGE ROLE
        isVerified: true,
        pendingApproval: false,
        updatedAt: Date.now(),
      });

      // ALSO: Update operator document with userId for security rules
      await updateDoc(doc(db, 'systemConfigurations', configId, 'operators', operatorId), {
        userId: uid,
      });

      logger.info('User approved successfully', { uid, configId, operatorId, profession });
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error approving user with config', { uid, configId, operatorId, error: err });
      throw error;
    }
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
