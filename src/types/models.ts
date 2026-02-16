/**
 * @file models.ts
 * @description Core data models for Nurse Hub
 * @author Nurse Hub Team
 */

// --- Shift Codes & Types ---

export type ShiftCode =
  | 'M' // Mattina
  | 'P' // Pomeriggio
  | 'N' // Notte
  | 'R' // Riposo
  | 'A' // Assenza
  | 'S' // Smonto
  | 'MP' // Mattina + Pomeriggio (Doppio Turno)
  | 'N11' // Notte Anticipata (20:00)
  | 'N12' // Notte Prolungata (19:00)
  | (string & {}); // Fallback per codici custom

export type RequestReason = 'SHORTAGE' | 'ABSENCE';

export type RequestStatus = 'OPEN' | 'PARTIAL' | 'CLOSED' | 'EXPIRED';

// --- Entities ---

export interface User {
  uid: string; // Firebase Auth UID
  email: string;
  role: 'user' | 'admin';
  operatorId: string | null; // Link to operators collection
  isVerified: boolean; // True if linked to an operator
  pendingApproval: boolean; // True if awaiting admin verification
  firstName: string; // First name from registration
  lastName: string; // Last name from registration
  dateOfBirth: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
  avatarUrl?: string;
  phoneNumber?: string;
  isBlocked?: boolean;
}

export interface Operator {
  id: string; // generated or row-index based
  name: string;
  email?: string;
  dateOfBirth?: string; // YYYY-MM-DD format for user matching
  phone?: string;
  role: string; // e.g. "Infermiere", "OSS"
  schedule: Record<string, ShiftCode>; // YYYY-MM-DD -> Code
  lastSync?: number; // Timestamp ultima sincronizzazione
}

export interface ShiftRequest {
  id: string;
  date: string; // YYYY-MM-DD
  originalShift: ShiftCode; // Il turno che manca (es. 'M')
  reason: RequestReason;
  status: RequestStatus;
  creatorId: string;
  createdAt: number;

  // Optional: tracking chi manca
  absentOperatorId?: string;
  requestNote?: string; // Note for the absence request (e.g. "Malattia", "Congedo")

  // Custom Time Range fields
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm

  // De-normalized counts for UI performance
  offersCount?: number;

  // Phase 10.1: Admin tracking fields
  rejectionReason?: string; // Required when status = 'REJECTED'
  rejectionTimestamp?: number; // Timestamp when rejected
  approvalTimestamp?: number; // Timestamp when approved
  adminId?: string; // UID of admin who approved/rejected
}

export interface ShiftOffer {
  id: string;
  requestId: string;
  operatorId: string;

  // Scenario details
  scenarioId: string; // References predefined scenarios
  roleIndex: number; // Which role in the scenario (if multi-role)

  timestamp: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

// --- Configuration & Scenarios ---

export interface ReplacementRole {
  roleLabel: string;
  originalShift: ShiftCode;
  newShift: ShiftCode;
  incentive: string;
  isNextDay?: boolean;
  requiredNextShift?: ShiftCode;
}

export interface ReplacementScenario {
  id: string;
  targetShift: ShiftCode;
  label: string;
  roles: ReplacementRole[];
}

export interface AppConfig {
  spreadsheetUrl: string;
  dateRowIndex: number;
  nameColumnIndex: number;
  dataStartRowIndex: number;
  dataStartColIndex: number;

  contactsUrl: string;
  contactsStartRow: number;
  contactNameCol: number;
  contactEmailCol: number;
  contactPhoneCol: number;

  gasWebUrl?: string; // Google Apps Script Web App URL for mailing
}

// --- Business Logic Types ---

export interface ComplianceResult {
  allowed: boolean;
  reason?: string; // If not allowed
  warning?: string; // If allowed but with warnings
}

export interface CompatibleScenario {
  scenarioId: string;
  scenarioLabel: string;
  roleIndex: number;
  newShift: ShiftCode;
  incentive: string;
}

// --- Phase 10.1: Notifications ---

export type NotificationType =
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'NEW_REQUEST'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED';

export interface Notification {
  id: string;
  userId: string; // User who should receive this notification
  type: NotificationType;
  message: string;
  requestId?: string; // Link to related request
  read: boolean;
  createdAt: number;
}
