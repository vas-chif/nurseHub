/**
 * @file useShiftLogic.ts
 * @description Composable containing the core business logic for shift compliance, replacement compatibility, and request expiration.
 * @author Nurse Hub Team
 * @created 2026-02-15
 * @modified 2026-04-27
 * @notes
 * - Evaluates legal constraints (e.g., Night shift cannot precede Morning shift).
 * - Maps shift shortages to valid replacement scenarios based on complex hierarchical roles.
 * - Handles shift-specific expiration timestamps (M/P/N).
 */
import { useScenarioStore } from '../stores/scenarioStore';
import type {
  ShiftCode,
  ComplianceResult,
  CompatibleScenario,
  ReplacementScenario,
  ReplacementRole,
  Operator,
} from '../types/models';

export function useShiftLogic() {
  /**
   * Checks if an operator can perform a new shift on a specific date,
   * considering their current shift and potential time overlaps.
   */
  function checkCompliance(
    currentShift: ShiftCode,
    newShift: ShiftCode,
    targetShift?: ShiftCode,
  ): ComplianceResult {
    // 1. Basic equality check (unless it's Rest)
    if (currentShift === newShift && currentShift !== 'R') {
      return { allowed: false, reason: `Già in turno ${currentShift}` };
    }

    // 2. Night-to-Morning rule (Standard Italian safety rest)
    if (currentShift === 'N' && newShift === 'M') {
      return { allowed: false, reason: 'Smonto Notte non può fare Mattina' };
    }

    // 3. Absence check
    if (currentShift === 'A') {
      return { allowed: false, reason: 'Operatore Assente' };
    }

    // 4. Overlap/Collision Detection (Phase 30 Fix)
    // If the operator is already working during the target shift's time, 
    // they can only cover it if the newShift is a recognized expansion (e.g. MP).
    if (targetShift && currentShift !== 'R' && currentShift !== 'S') {
      const currentRange = getShiftTimeRange(currentShift);
      const targetRange = getShiftTimeRange(targetShift);
      
      const overlaps = hasSignificantOverlap(
        currentRange[0], currentRange[1],
        targetRange[0], targetRange[1]
      );

      // If they overlap, they are only eligible if the newShift is DIFFERENT from currentShift
      // and ideally encompasses the need (the scenario logic usually handles this, 
      // but we add a safety barrier here).
      if (overlaps && newShift === currentShift) {
        return { allowed: false, reason: 'Collisione oraria: già in servizio' };
      }
    }

    return { allowed: true };
  }

  /**
   * Finds all possible replacement scenarios for a target shift shortage,
   * given a specific operator.
   * 
   * @param req - The request details (date and original shift).
   * @param op - The operator to check.
   * @param scenarios - Optional custom scenarios list.
   */
  function getCompatibleScenarios(
    req: { date: string; originalShift: ShiftCode },
    op: Operator,
    scenarios?: ReplacementScenario[],
  ): CompatibleScenario[] {
    const validScenarios: CompatibleScenario[] = [];
    const sourceScenarios = scenarios ?? useScenarioStore().scenarios;
    const filtered = sourceScenarios.filter(
      (s: ReplacementScenario) => s.targetShift === req.originalShift,
    );

    for (const scenario of filtered) {
      scenario.roles.forEach((role: ReplacementRole, index: number) => {
        if (isOperatorEligibleForRole(req.date, req.originalShift, op, role)) {
          validScenarios.push({
            scenarioId: scenario.id,
            scenarioLabel: scenario.label,
            roleIndex: index,
            roleLabel: role.roleLabel,
            newShift: role.newShift,
            incentive: role.incentive,
          });
        }
      });
    }

    return validScenarios;
  }

  /**
   * Checks if a request (absence or swap) is expired based on the shift's exact start time.
   * Mattina (M) -> expires at 07:00
   * Pomeriggio (P) -> expires at 14:00
   * Notte (N) -> expires at 21:00
   */
  function isRequestExpired(dateStr: string, shiftCode: ShiftCode): boolean {
    if (!dateStr || !shiftCode) return false;

    // Parse the date (assumed format YYYY-MM-DD or similar standard format)
    const shiftDate = new Date(dateStr);
    if (isNaN(shiftDate.getTime())) return false; // Invalid date

    // Set expiration hours based on Italian time (browser local time is used)
    if (shiftCode.startsWith('M')) {
      shiftDate.setHours(7, 0, 0, 0);
    } else if (shiftCode.startsWith('P')) {
      shiftDate.setHours(14, 0, 0, 0);
    } else if (shiftCode.startsWith('N')) {
      shiftDate.setHours(21, 0, 0, 0);
    } else {
      // For DayOff (R) or others without a precise time, expire at 23:59:59
      shiftDate.setHours(23, 59, 59, 999);
    }

    return Date.now() > shiftDate.getTime();
  }

  /**
   * Returns the standard [start, end] time range for a given shift code.
   * Format: "HH:mm"
   */
  function getShiftTimeRange(shiftCode: ShiftCode): [string, string] {
    if (!shiftCode) return ['00:00', '00:00'];

    const code = shiftCode.toString().toUpperCase();

    if (code.startsWith('M')) return ['07:00', '14:00'];
    if (code.startsWith('P')) return ['14:00', '21:00'];
    if (code.startsWith('N')) return ['21:00', '07:00']; // Ends next day
    if (code === 'MP') return ['07:00', '21:00'];

    // Default fallback
    return ['00:00', '00:00'];
  }

  /**
   * Checks if two time intervals overlap by at least 1 hour.
   * Times are in "HH:mm" format.
   */
  function hasSignificantOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    const toMinutes = (t: string) => {
      const parts = t.split(':');
      const h = Number(parts[0] || 0);
      const m = Number(parts[1] || 0);
      return h * 60 + m;
    };

    const start1 = toMinutes(s1);
    let end1 = toMinutes(e1);
    const start2 = toMinutes(s2);
    let end2 = toMinutes(e2);

    // Handle night shift cross-over
    if (end1 <= start1) end1 += 24 * 60;
    if (end2 <= start2) end2 += 24 * 60;

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    const overlapMinutes = overlapEnd - overlapStart;
    return overlapMinutes >= 60; // At least 1 hour
  }

  /**
   * Checks if a specific scenario role is still valid based on current time.
   * Prevents suggesting "MP" (Morning+Afternoon) to someone at 12:00 PM
   * because the "Morning" part has already started/passed.
   */
  function isScenarioTimeValid(dateStr: string, currentShift: ShiftCode, newShift: ShiftCode): boolean {
    const now = new Date();
    const shiftDate = new Date(dateStr);
    
    // Only applies to "Today"
    const todayStr = now.toISOString().split('T')[0];
    if (dateStr !== todayStr) return true;

    // 1. Check if the currentShift has already started.
    // If it has, we can ONLY "Prolong" it. We cannot "Replace" it.
    const currentRange = getShiftTimeRange(currentShift);
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const currentStartMins = toMinutes(currentRange[0]);
    const currentEndMins = toMinutes(currentRange[1]);
    
    if (currentStartMins > 0 || currentEndMins > 0) {
      const startTime = new Date(shiftDate);
      const [sh, sm] = currentRange[0].split(':').map(Number);
      startTime.setHours(sh || 0, sm || 0, 0, 0);

      const endTime = new Date(shiftDate);
      const [eh, em] = currentRange[1].split(':').map(Number);
      endTime.setHours(eh || 0, em || 0, 0, 0);
      
      // Handle cross-day shifts (e.g. Night shift ends next day)
      if (currentEndMins <= currentStartMins && currentStartMins > 0) {
        endTime.setDate(endTime.getDate() + 1);
      }

      // A. END TIME GUARD: If current shift ended more than 30 mins ago, operator is GONE.
      if (now.getTime() > endTime.getTime() + (30 * 60 * 1000)) {
        return false;
      }

      // B. START TIME GUARD (In-Shift Logic)
      if (now.getTime() > startTime.getTime() + (30 * 60 * 1000)) {
        // We are "In Shift".
        // The newShift MUST contain the currentShift (Prolongation).
        const newRange = getShiftTimeRange(newShift);
        const newStartMins = toMinutes(newRange[0]);
        
        if (newStartMins > currentStartMins) {
          return false;
        }
      }
    }

    // 2. Original Logic: Check if the newShift itself is in the past (Anticipi)
    const newRange = getShiftTimeRange(newShift);
    const newStart = toMinutes(newRange[0]);
    const oldStart = currentStartMins;

    if (newStart < oldStart && oldStart > 0) {
      const startTime = new Date(shiftDate);
      const [h, m] = newRange[0].split(':').map(Number);
      startTime.setHours(h || 0, m || 0, 0, 0);
      return now.getTime() < startTime.getTime() + (30 * 60 * 1000);
    }

    return true;
  }

  /**
   * Centralized Matching Engine (Expert System).
   * Decides if an operator is eligible for a specific role in a scenario.
   * This is the Single Source of Truth for Admin Suggestions, User Dashboard, and Notifications.
   */
  function isOperatorEligibleForRole(
    reqDate: string,
    targetShift: ShiftCode,
    op: Operator,
    role: {
      originalShift: ShiftCode;
      newShift: ShiftCode;
      isNextDay?: boolean;
      requiredNextShift?: ShiftCode;
    }
  ): boolean {
    // 1. Keyword Exclusion (PS, Coordinatore, etc.)
    if (isExcluded(op)) return false;

    const nextDate = new Date(new Date(reqDate).getTime() + 86400000)
      .toISOString()
      .split('T')[0]!;
    
    const cur = op.schedule?.[reqDate] ?? 'R';
    const nxt = op.schedule?.[nextDate] ?? 'R';

    // 2. Shift Match Check (Does the operator have the required shift in calendar?)
    const isMatch = role.isNextDay ? nxt === role.originalShift : cur === role.originalShift;
    if (!isMatch) return false;

    // 3. Redundancy Check (If they already work what we need, e.g. P->P, skip notification)
    if (role.newShift === (role.isNextDay ? nxt : cur)) return false;

    // 4. Required Next Shift Check (e.g. must be R tomorrow to do N tonight)
    if (role.requiredNextShift && nxt !== role.requiredNextShift) return false;

    // 5. Compliance & Temporal Guard
    const shiftToCheck = role.isNextDay ? nxt : cur;
    const compliance = checkCompliance(shiftToCheck, role.newShift, targetShift);
    const isTimeValid = isScenarioTimeValid(reqDate, shiftToCheck, role.newShift);

    return compliance.allowed && isTimeValid;
  }

  const EXCLUDED_KEYWORDS = ['SUB INTENSIVA', 'PS', 'BLOCCO OPERATORIO', 'IFC', 'COORDINATORE'];
  function isExcluded(op: Operator): boolean {
    const fullName = (op.name || `${op.firstName || ''} ${op.lastName || ''}`).toUpperCase();
    return EXCLUDED_KEYWORDS.some((k) => fullName.includes(k));
  }

  function getOperatorDisplayName(op: Operator): string {
    return (op.name || `${op.firstName || ''} ${op.lastName || ''}`).trim() || 'Operatore';
  }

  return {
    checkCompliance,
    getCompatibleScenarios,
    isRequestExpired,
    isScenarioTimeValid,
    isOperatorEligibleForRole,
    getShiftTimeRange,
    hasSignificantOverlap,
    isExcluded,
    getOperatorDisplayName,
  };
}
