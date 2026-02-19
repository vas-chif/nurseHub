import { REPLACEMENT_SCENARIOS } from '../config/sheets';
import type { ShiftCode, ComplianceResult, CompatibleScenario } from '../types/models';

export function useShiftLogic() {
  /**
   * Checks if an operator can perform a new shift on a specific date.
   * This is a simplified check. In a real app, you'd check previous/next day shifts too.
   */
  function checkCompliance(currentShift: ShiftCode, newShift: ShiftCode): ComplianceResult {
    // 1. Basic conflict: Cannot do the same shift twice if meaningful (M->M no, R->M yes)
    if (currentShift === newShift && currentShift !== 'R') {
      return { allowed: false, reason: `Già in turno ${currentShift}` };
    }

    // 2. Night shift rules (simplified)
    if (currentShift === 'N' && newShift === 'M') {
      return { allowed: false, reason: 'Smonto Notte non può fare Mattina' };
    }

    // 3. Absence
    if (currentShift === 'A') {
      return { allowed: false, reason: 'Operatore Assente' };
    }

    return { allowed: true };
  }

  /**
   * Finds all possible replacement scenarios for a target shift shortage,
   * given a specific operator's current shift.
   */
  function getCompatibleScenarios(
    targetShift: ShiftCode,
    operatorShift: ShiftCode,
  ): CompatibleScenario[] {
    const validScenarios: CompatibleScenario[] = [];

    // Filter scenarios that solve the target shift shortage
    const scenarios = REPLACEMENT_SCENARIOS.filter((s) => s.targetShift === targetShift);

    for (const scenario of scenarios) {
      // Check each role in the scenario
      scenario.roles.forEach((role, index) => {
        // Does the operator have the 'originalShift' required by this role?
        // e.g. If role needs 'R', operator must be 'R'
        if (role.originalShift === operatorShift) {
          // Secondary check: is the transition compliant?
          const compliance = checkCompliance(operatorShift, role.newShift);

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
