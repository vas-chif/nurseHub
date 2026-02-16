/**
 * @file useUserContext.ts
 * @description Composable for determining active operator context and permissions
 * @author Nurse Hub Team
 */

import { computed } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { operatorsService } from '../services/OperatorsService';
import { useShiftLogic } from './useShiftLogic';
import type { Operator, ShiftRequest } from '../types/models';

export function useUserContext() {
  const authStore = useAuthStore();
  const configStore = useConfigStore();
  const { getCompatibleScenarios } = useShiftLogic();

  /**
   * Returns the operators whose data should be displayed
   * - User: returns only their own operator
   * - Admin: returns selected operators (or own if none selected)
   */
  const activeOperators = computed<Operator[]>(() => {
    if (!authStore.currentOperator) {
      return [];
    }

    if (authStore.isAdmin && authStore.selectedOperatorIds.length > 0) {
      // Admin with selected operators - would need to fetch them
      // For now, return current operator as placeholder
      return [authStore.currentOperator];
    }

    // User or admin without selection - show own operator
    return [authStore.currentOperator];
  });

  /**
   * Returns the primary active operator (first in the list)
   */
  const primaryOperator = computed<Operator | null>(() => {
    return activeOperators.value[0] || null;
  });

  /**
   * Checks if the current user can view a specific shift request
   * - Admin: can view all requests
   * - User: can only view requests they're compatible with
   */
  function canViewRequest(request: ShiftRequest): boolean {
    // Admin sees everything
    if (authStore.isAdmin) {
      return true;
    }

    // User must be verified and linked to an operator
    if (!authStore.isVerified || !authStore.currentOperator) {
      return false;
    }

    // Check if user's current shift for that date is compatible with the request
    const userShift = authStore.currentOperator.schedule[request.date];
    if (!userShift) {
      return false;
    }

    // Use business logic to determine compatibility
    const compatibleScenarios = getCompatibleScenarios(request.originalShift, userShift);

    return compatibleScenarios.length > 0;
  }

  /**
   * Helper to check if current user is admin
   */
  function isAdmin(): boolean {
    return authStore.isAdmin;
  }

  /**
   * Helper to check if current user is verified
   */
  function isVerified(): boolean {
    return authStore.isVerified;
  }

  /**
   * Fetches selected operators data (for admin)
   */
  async function fetchSelectedOperators(): Promise<Operator[]> {
    if (!authStore.isAdmin || authStore.selectedOperatorIds.length === 0) {
      return authStore.currentOperator ? [authStore.currentOperator] : [];
    }

    if (!configStore.activeConfigId) {
      return authStore.currentOperator ? [authStore.currentOperator] : [];
    }

    const operators: Operator[] = [];
    for (const opId of authStore.selectedOperatorIds) {
      const operator = await operatorsService.getOperatorById(configStore.activeConfigId, opId);
      if (operator) {
        operators.push(operator);
      }
    }

    return operators;
  }

  return {
    activeOperators,
    primaryOperator,
    canViewRequest,
    isAdmin,
    isVerified,
    fetchSelectedOperators,
  };
}
