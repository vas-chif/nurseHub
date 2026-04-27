/**
 * @file auth.ts
 * @description Authentication and authorization types for multi-level hierarchy (SuperAdmin, Admin, User)
 * @author Nurse Hub Team
 * @created 2026-04-27
 */

export type UserRole = 'superAdmin' | 'admin' | 'user';

export interface IUserPermissions {
  manageAdmins: boolean;  // can promote/demote/edit other admins
  manageSystem: boolean;  // access to system configuration and backups
  viewAuditLogs: boolean; // access to compliance/GDPR logs
}

/**
 * Admin-only: stored in Firestore userProfiles.managerialInfo
 * Controlled via Cloud Functions ONLY (§1.10)
 */
export interface IManagerialInfo {
  role: UserRole;
  managedConfigIds: string[]; // List of configId strings this admin can manage
  permissions: IUserPermissions;
  updatedAt: number;
}

/**
 * JWT Custom Claims (flat structure for Auth token size)
 */
export interface ICustomClaims {
  role: UserRole;
  managedConfigIds: string[]; // Serialized as array in token
  permissions: IUserPermissions;
  isActive: boolean;
  profileComplete: boolean;
}

/**
 * Resolved admin object for UI lists
 */
export interface IAdminUser {
  uid: string;
  email: string;
  role: UserRole;
  managedConfigIds: string[];
  permissions: IUserPermissions;
  displayName: string;
}
