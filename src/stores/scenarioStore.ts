/**
 * @file scenarioStore.ts
 * @description Pinia store for caching and managing replacement scenarios from Firestore.
 * Scenarios are loaded once per session per configId and cached in memory.
 * If Firestore is empty, standard predefined 13 scenarios are used and written back.
 * @author Nurse Hub Team
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import type { ReplacementScenario } from '../types/models';
import { useSecureLogger } from '../utils/secureLogger';

const logger = useSecureLogger();

const DEFAULT_13_SCENARIOS: ReplacementScenario[] = [
  // --- MANCANZA TURNO M (4 scenari) ---
  {
    id: 'M1',
    targetShift: 'M',
    label: '1-Copertura Singola (R ➔ M)',
    roles: [
      { roleLabel: 'Personale a riposo (R) che copre la mattina', originalShift: 'R', newShift: 'M', incentive: 'Straordinario incentivato M (07:00-14:00)' },
    ],
  },
  {
    id: 'M2',
    targetShift: 'M',
    label: '2-Copertura Combinata 2 Operatori (MP + N12)',
    roles: [
      { roleLabel: 'Personale di pomeriggio (P) che anticipa (MP)', originalShift: 'P', newShift: 'MP', incentive: 'Copertura parziale mattina (07:00-14:00)' },
      { roleLabel: 'Personale di notte (N) che prolunga (N12)', originalShift: 'N', newShift: 'N12', incentive: 'Straordinario incentivato (19:00-21:00)' },
    ],
  },
  {
    id: 'M3',
    targetShift: 'M',
    label: '3-Copertura Combinata 3 Operatori (MP + P➔M + N12)',
    roles: [
      { roleLabel: 'Personale di mattina (M) che prolunga (MP)', originalShift: 'M', newShift: 'MP', incentive: 'Straordinario incentivato P (14:00-19:00)' },
      { roleLabel: 'Personale di pomeriggio (P) che anticipa (M)', originalShift: 'P', newShift: 'M', incentive: 'Copertura Turno Mattina' },
      { roleLabel: 'Personale di notte (N) che prolunga (N12)', originalShift: 'N', newShift: 'N12', incentive: 'Straordinario incentivato (19:00-21:00)' },
    ],
  },
  {
    id: 'M4',
    targetShift: 'M',
    label: '4-Copertura Combinata 3 Operatori (P➔M + N➔P + S➔N)',
    roles: [
      { roleLabel: 'Personale di pomeriggio (P) che anticipa (M)', originalShift: 'P', newShift: 'M', incentive: 'Copertura Turno Mattina' },
      { roleLabel: 'Personale di notte (N) che anticipa (P)', originalShift: 'N', newShift: 'P', incentive: 'Copertura Turno Pomeriggio' },
      { roleLabel: 'Personale di smonto (S) che copre la notte (N)', originalShift: 'S', newShift: 'N', incentive: 'Straordinario incentivato N (21:00-07:00)', requiredNextShift: 'R' },
    ],
  },

  // --- MANCANZA TURNO P (5 scenari) ---
  {
    id: 'P1',
    targetShift: 'P',
    label: '1-Copertura Combinata 2 Operatori (R ➔ P+N11)',
    roles: [
      { roleLabel: 'Personale a riposo (R) che copre il pomeriggio', originalShift: 'R', newShift: 'P', incentive: 'Straordinario incentivato P (14:00-20:00)' },
      { roleLabel: 'Personale in turno notte (N) che anticipa (N11)', originalShift: 'N', newShift: 'N11', incentive: 'Straordinario incentivato (20:00-21:00)' },
    ],
  },
  {
    id: 'P2',
    targetShift: 'P',
    label: '2-Copertura Combinata 2 Operatori (MP+N12)',
    roles: [
      { roleLabel: 'Personale di mattina (M) che prolunga (MP)', originalShift: 'M', newShift: 'MP', incentive: 'Straordinario incentivato P (14:00-19:00)' },
      { roleLabel: 'Personale di notte (N) che prolunga (N12)', originalShift: 'N', newShift: 'N12', incentive: 'Straordinario incentivato (19:00-21:00)' },
    ],
  },
  {
    id: 'P3',
    targetShift: 'P',
    label: '3-Copertura Combinata 2 Operatori (N ➔ P + S ➔ N)',
    roles: [
      { roleLabel: 'Personale di notte (N) che anticipa il pomeriggio', originalShift: 'N', newShift: 'P', incentive: 'Copertura Turno Pomeriggio' },
      { roleLabel: 'Personale di smonto (S) che copre la notte (N)', originalShift: 'S', newShift: 'N', incentive: 'Straordinario incentivato N (21:00-07:00)', requiredNextShift: 'R' },
    ],
  },
  {
    id: 'P4',
    targetShift: 'P',
    label: '4-Copertura Combinata 2 Operatori (M➔P+R➔M)',
    roles: [
      { roleLabel: 'Personale di mattina (M) che prolunga il pomeriggio', originalShift: 'M', newShift: 'P', incentive: 'Copertura Turno Pomeriggio' },
      { roleLabel: 'Personale a riposo (R) che copre la mattina', originalShift: 'R', newShift: 'M', incentive: 'Copertura Turno Mattina' },
    ],
  },
  {
    id: 'P5',
    targetShift: 'P',
    label: '5-Copertura Combinata 3 Operatori (M➔P+MP+N12)',
    roles: [
      { roleLabel: 'Personale di mattina (M) che copre il pomeriggio', originalShift: 'M', newShift: 'P', incentive: 'Copertura Turno Pomeriggio' },
      { roleLabel: 'Personale di pomeriggio (P) anticipa (MP)', originalShift: 'P', newShift: 'MP', incentive: 'Copertura parziale mattina (07:00-14:00)' },
      { roleLabel: 'Personale di notte (N) che prolunga (N12)', originalShift: 'N', newShift: 'N12', incentive: 'Straordinario incentivato (19:00-21:00)' },
    ],
  },

  // --- MANCANZA TURNO N (4 scenari) ---
  {
    id: 'N1',
    targetShift: 'N',
    label: '1-Copertura singola (S ➔ N)',
    roles: [
      { roleLabel: 'Personale di smonto che può fare la notte', originalShift: 'S', newShift: 'N', incentive: 'Straordinario incentivato N (21:00-07:00)', requiredNextShift: 'R' },
    ],
  },
  {
    id: 'N2',
    targetShift: 'N',
    label: '2-Copertura Combinata 2 Operatori R➔N + R1➔M',
    roles: [
      { roleLabel: 'Personale a riposo (R) che copre la notte', originalShift: 'R', newShift: 'N', incentive: 'Copertura Turno Notte' },
      { roleLabel: 'Personale a riposo domani che anticipa la mattina', originalShift: 'R', newShift: 'M', incentive: 'Straordinario incentivato M (07:00-14:00)', isNextDay: true },
    ],
  },
  {
    id: 'N3',
    targetShift: 'N',
    label: '3-Copertura Combinata 2 Operatori P➔N12 + M➔MP',
    roles: [
      { roleLabel: 'Personale di pomeriggio (P) prolunga la notte', originalShift: 'P', newShift: 'N12', incentive: 'Straordinario incentivato N (21:00-07:00)' },
      { roleLabel: 'Personale di mattina (M) prolunga il pomeriggio', originalShift: 'M', newShift: 'MP', incentive: 'Straordinario incentivato P (14:00-21:00)' },
    ],
  },
  {
    id: 'N4',
    targetShift: 'N',
    label: '4-Copertura Combinata 3 Operatori (M ➔ P+P ➔ N+R ➔M)',
    roles: [
      { roleLabel: 'Personale di mattina (M) sposta al pomeriggio', originalShift: 'M', newShift: 'P', incentive: 'Copertura Turno Pomeriggio' },
      { roleLabel: 'Personale di pomeriggio (P) sposta alla notte', originalShift: 'P', newShift: 'N', incentive: 'Copertura Turno Notte' },
      { roleLabel: 'Personale a riposo (R) copre la mattina', originalShift: 'R', newShift: 'M', incentive: 'Copertura Turno Mattina' },
    ],
  },
];

export const useScenarioStore = defineStore('scenarios', () => {
  const scenarios = ref<ReplacementScenario[]>([]);
  const loadedConfigId = ref<string | null>(null);
  const loading = ref(false);

  /**
   * Seeds the default scenarios to Firestore for a specific system configuration
   */
  async function seedDefaultScenarios(configId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      const colRef = collection(db, 'systemConfigurations', configId, 'replacementScenarios');
      
      DEFAULT_13_SCENARIOS.forEach(scenario => {
        const scenarioDoc = doc(colRef, scenario.id);
        batch.set(scenarioDoc, scenario);
      });
      
      await batch.commit();
      logger.info('Seeded default scenarios to Firestore', { configId, scenarioCount: DEFAULT_13_SCENARIOS.length });
    } catch (e) {
      logger.error('Failed to seed scenarios', e);
    }
  }

  /**
   * Loads replacement scenarios for the given configId from Firestore.
   * Uses cached value if the same configId was already loaded.
   */
  async function loadScenarios(configId: string): Promise<void> {
    if (loadedConfigId.value === configId && scenarios.value.length > 0) return; // Already loaded
    if (!configId) return;

    loading.value = true;
    try {
      const colRef = collection(db, 'systemConfigurations', configId, 'replacementScenarios');
      const snap = await getDocs(colRef);

      if (!snap.empty) {
        scenarios.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReplacementScenario);
        // Sort by ID to keep logical order (M1, M2...)
        scenarios.value.sort((a, b) => a.id.localeCompare(b.id));
        loadedConfigId.value = configId;
        logger.info('Loaded replacement scenarios from Firestore', { configId, count: scenarios.value.length });
      } else {
        // Firestore subcollection empty — seed it and fall back to memory
        logger.warn('No Firestore scenarios found, seeding predefined defaults', { configId });
        await seedDefaultScenarios(configId);
        scenarios.value = [...DEFAULT_13_SCENARIOS];
        loadedConfigId.value = configId;
      }
    } catch (e) {
      logger.error('Failed to load Firestore scenarios', e);
      scenarios.value = [...DEFAULT_13_SCENARIOS]; // Fallback if offline
    } finally {
      loading.value = false;
    }
  }

  /** Force-reload scenarios (used after admin edits) */
  function invalidate() {
    loadedConfigId.value = null;
    scenarios.value = [];
  }

  return {
    scenarios,
    loading,
    loadedConfigId,
    loadScenarios,
    seedDefaultScenarios,
    invalidate,
  };
});
