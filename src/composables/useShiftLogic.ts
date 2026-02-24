import { REPLACEMENT_SCENARIOS } from '../config/sheets';
import type {
  ShiftCode,
  ComplianceResult,
  CompatibleScenario,
  ReplacementScenario,
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
   *                  Falls back to hardcoded REPLACEMENT_SCENARIOS if omitted.
   */
  function getCompatibleScenarios(
    targetShift: ShiftCode,
    operatorShift: ShiftCode,
    reqDate?: string,
    operatorSchedule?: Record<string, string>,
    scenarios?: ReplacementScenario[],
  ): CompatibleScenario[] {
    const validScenarios: CompatibleScenario[] = [];
    const sourceScenarios = scenarios ?? REPLACEMENT_SCENARIOS;
    const filtered = sourceScenarios.filter((s) => s.targetShift === targetShift);

    let nextShift: ShiftCode = 'R';
    if (reqDate && operatorSchedule) {
      const shiftDate = new Date(reqDate);
      const nextDateObj = new Date(shiftDate);
      nextDateObj.setDate(shiftDate.getDate() + 1);
      const nextDateStr = nextDateObj.toISOString().split('T')[0]!;
      nextShift = (operatorSchedule[nextDateStr] as ShiftCode) || 'R';
    }

    for (const scenario of filtered) {
      scenario.roles.forEach((role, index) => {
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

  return {
    checkCompliance,
    getCompatibleScenarios,
  };
}
