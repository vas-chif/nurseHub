import { useScenarioStore } from '../stores/scenarioStore';
import type {
  ShiftCode,
  ComplianceResult,
  CompatibleScenario,
  ReplacementScenario,
  ReplacementRole,
} from '../types/models';

export function useShiftLogic() {
  /**
   * Checks if an operator can perform a new shift on a specific date.
   */
  function checkCompliance(currentShift: ShiftCode, newShift: ShiftCode): ComplianceResult {
    if (currentShift === newShift && currentShift !== 'R') {
      return { allowed: false, reason: `Già in turno ${currentShift}` };
    }
    if (currentShift === 'N' && newShift === 'M') {
      return { allowed: false, reason: 'Smonto Notte non può fare Mattina' };
    }
    if (currentShift === 'A') {
      return { allowed: false, reason: 'Operatore Assente' };
    }
    return { allowed: true };
  }

  /**
   * Finds all possible replacement scenarios for a target shift shortage,
   * given a specific operator's current shift.
   *
   * @param scenarios Optional — pass Firestore-loaded scenarios to use live data.
   *                  Falls back to current scenarios in scenarioStore if omitted.
   */
  function getCompatibleScenarios(
    targetShift: ShiftCode,
    operatorShift: ShiftCode,
    reqDate?: string,
    operatorSchedule?: Record<string, string>,
    scenarios?: ReplacementScenario[],
  ): CompatibleScenario[] {
    const validScenarios: CompatibleScenario[] = [];
    const sourceScenarios = scenarios ?? useScenarioStore().scenarios;
    const filtered = sourceScenarios.filter((s: ReplacementScenario) => s.targetShift === targetShift);

    let nextShift: ShiftCode = 'R';
    if (reqDate && operatorSchedule) {
      const shiftDate = new Date(reqDate);
      const nextDateObj = new Date(shiftDate);
      nextDateObj.setDate(shiftDate.getDate() + 1);
      const nextDateStr = nextDateObj.toISOString().split('T')[0]!;
      nextShift = (operatorSchedule[nextDateStr] as ShiftCode) || 'R';
    }

    for (const scenario of filtered) {
      scenario.roles.forEach((role: ReplacementRole, index: number) => {
        let isMatch = false;

        if (role.isNextDay) {
          if (reqDate && operatorSchedule) {
            isMatch = nextShift === role.originalShift;
          }
        } else {
          isMatch = operatorShift === role.originalShift;
        }

        if (isMatch && role.requiredNextShift) {
          if (!reqDate || !operatorSchedule || nextShift !== role.requiredNextShift) {
            isMatch = false;
          }
        }

        if (isMatch) {
          const shiftToCheck = role.isNextDay ? nextShift : operatorShift;
          const compliance = checkCompliance(shiftToCheck, role.newShift);
          if (compliance.allowed) {
            validScenarios.push({
              scenarioId: scenario.id,
              scenarioLabel: scenario.label,
              roleIndex: index,
              roleLabel: role.roleLabel,
              newShift: role.newShift,
              incentive: role.incentive,
            });
          }
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

  return {
    checkCompliance,
    getCompatibleScenarios,
    isRequestExpired,
  };
}
