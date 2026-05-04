/**
 * @file useAbsenceForm.ts
 * @description Composable for the two-step absence request form.
 * Step 1 "form": collects operator (admin), date range, shift mode, and reason.
 * Step 2 "preview": per-day table built from operator schedule; each row is
 * individually editable (shift, reason) and excludable before final submission.
 * @author Nurse Hub Team
 * @created 2026-05-04
 * @modified 2026-05-04
 * @notes
 * - generatePreview() reads op.schedule[date] for every day in the range.
 * - Per-day conflict flag (scheduledShift ≠ formData.shift) shown as warning;
 *   does NOT block — user can correct or exclude each row.
 * - confirmAndSubmit() saves only non-excluded rows; max 31 days per call.
 * - notifyEligibleOperators via dynamic import (reduces initial bundle size).
 * - Max 31 days per request batch.
 * @dependencies
 * - authStore, configStore (Pinia)
 * - Firebase Firestore (addDoc, collection)
 * - NotificationService (dynamic import)
 * - dateUtils (formatToDb, formatToItalian)
 * - src/types/models (AbsencePreviewRow, ShiftRequest, …)
 */
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../boot/firebase';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { useSecureLogger } from '../utils/secureLogger';
import { formatToItalian, formatToDb } from '../utils/dateUtils';
import type {
  ShiftRequest,
  ShiftCode,
  RequestReason,
  Operator,
  AbsencePreviewRow,
} from '../types/models';

/**
 * Composable for the two-step absence request form.
 *
 * @param onSuccess - Callback invoked after a successful submission
 * @returns Reactive state and action functions for both form steps
 */
export function useAbsenceForm(onSuccess: () => void) {
  const $q = useQuasar();
  const logger = useSecureLogger();
  const authStore = useAuthStore();
  const configStore = useConfigStore();

  // ─── Step control ────────────────────────────────────────────────────────
  const step = ref<'form' | 'preview'>('form');
  const generatingPreview = ref(false);
  const submitting = ref(false);

  // ─── Operator selector (admin only) ──────────────────────────────────────
  const filterText = ref('');
  const selectedOperatorId = ref(
    authStore.isAnyAdmin ? '' : (authStore.currentOperator?.id ?? ''),
  );
  const operators = ref<Record<string, Operator>>({});

  const filteredOperatorOptions = computed(() => {
    const list = Object.values(operators.value).map((op) => ({
      id: op.id,
      name: op.name,
    }));
    if (!filterText.value) return list;
    const needle = filterText.value.toLowerCase();
    return list.filter((v) => v.name.toLowerCase().includes(needle));
  });

  function filterOperators(val: string, update: (cb: () => void) => void): void {
    update(() => {
      filterText.value = val;
    });
  } /*end filterOperators*/

  /** Replaces the local operator map with a fresh list from the schedule store. */
  function syncOperators(list: Operator[]): void {
    const record: Record<string, Operator> = {};
    list.forEach((op) => {
      record[op.id] = op;
    });
    operators.value = record;
  } /*end syncOperators*/

  // ─── Form data ───────────────────────────────────────────────────────────
  const today = formatToDb(new Date());
  const inputMode = ref<'SHIFT' | 'TIME'>('SHIFT');

  const formData = ref({
    date: today,
    endDate: today,
    isRecurring: false,
    shift: 'M' as ShiftCode,
    startTime: '',
    endTime: '',
    absenceLabel: 'Assenza Generica',
    note: '',
  });

  const absenceOptions = [
    { label: 'Assenza Generica', value: 'Assenza Generica' },
    { label: 'Malattia', value: 'Malattia' },
    { label: 'Congedo', value: 'Congedo' },
    { label: 'Ferie', value: 'Ferie' },
    { label: 'Altro', value: 'Altro' },
  ];

  const shiftOptions = [
    { label: 'M - Mattina', value: 'M' },
    { label: 'P - Pomeriggio', value: 'P' },
    { label: 'N - Notte', value: 'N' },
    { label: 'S - Smonto', value: 'S' },
    { label: 'R - Riposo', value: 'R' },
    { label: 'A - Assenza', value: 'A' },
  ];

  // ─── Preview rows ─────────────────────────────────────────────────────────
  const previewRows = ref<AbsencePreviewRow[]>([]);
  const previewActiveCount = computed(
    () => previewRows.value.filter((r) => !r.excluded).length,
  );

  /** Expose isAnyAdmin so the template does not need to import authStore. */
  const isAnyAdmin = computed(() => authStore.isAnyAdmin);

  // ─── Step 1: generate preview ─────────────────────────────────────────────
  /**
   * Validates form inputs, expands the date range, reads per-day scheduled
   * shifts from the operator's schedule, and populates previewRows.
   * Switches to 'preview' step on success.
   */
  function generatePreview(): void {
    if (!formData.value.date) {
      $q.notify({ type: 'warning', message: 'Seleziona una data' });
      return;
    }
    if (
      inputMode.value === 'TIME' &&
      (!formData.value.startTime || !formData.value.endTime)
    ) {
      $q.notify({ type: 'warning', message: 'Specifica Orario Inizio e Fine' });
      return;
    }

    const targetOperatorId = authStore.isAnyAdmin
      ? selectedOperatorId.value
      : (authStore.currentOperator?.id ?? '');

    if (!targetOperatorId) {
      $q.notify({
        type: 'warning',
        message: authStore.isAnyAdmin
          ? 'Seleziona un operatore'
          : 'Profilo operatore non collegato. Associa il tuo account nel Profilo.',
      });
      return;
    }

    // Build date list
    const dates: string[] = [];
    if (formData.value.isRecurring && formData.value.endDate) {
      const current = new Date(formData.value.date);
      const end = new Date(formData.value.endDate);
      if (end < current) {
        $q.notify({
          type: 'warning',
          message: 'La data fine deve essere uguale o successiva alla data inizio',
        });
        return;
      }
      while (current <= end) {
        dates.push(formatToDb(current));
        current.setDate(current.getDate() + 1);
      }
    } else {
      dates.push(formData.value.date);
    }

    if (dates.length > 31) {
      $q.notify({ type: 'negative', message: 'Massimo 31 giorni per volta' });
      return;
    }

    // Validate that the operator's scheduled shift on the first date matches
    // the selected shift (SHIFT mode only). Block preview generation if mismatch.
    if (inputMode.value === 'SHIFT') {
      const op = operators.value[targetOperatorId];
      const firstDate = dates[0];
      const scheduledOnFirstDay: ShiftCode | null =
        op?.schedule?.[firstDate ?? ''] ?? null;
      if (
        firstDate &&
        scheduledOnFirstDay !== null &&
        scheduledOnFirstDay !== formData.value.shift
      ) {
        const opName = op?.name ?? 'L\'operatore';
        $q.notify({
          type: 'warning',
          icon: 'event_busy',
          message: `Turno non corrispondente`,
          caption: `${opName} il ${formatToItalian(firstDate)} è in turno ${
            scheduledOnFirstDay
          }. Seleziona il turno corretto oppure usa la modalità Orario.`,
          multiLine: true,
          timeout: 6000,
        });
        return;
      }
    }

    generatingPreview.value = true;
    try {
      const op = operators.value[targetOperatorId];
      previewRows.value = dates.map((date): AbsencePreviewRow => {
        const scheduledShift: ShiftCode | null =
          op?.schedule?.[date] ?? null;
        const selectedShift: ShiftCode =
          inputMode.value === 'TIME'
            ? 'A'
            : (scheduledShift ?? formData.value.shift);
        const conflict =
          inputMode.value === 'SHIFT' &&
          scheduledShift !== null &&
          scheduledShift !== formData.value.shift;
        return {
          date,
          scheduledShift,
          selectedShift,
          absenceLabel: formData.value.absenceLabel,
          note: formData.value.note,
          excluded: false,
          conflict,
        };
      });
      step.value = 'preview';
    } finally {
      generatingPreview.value = false;
    }
  } /*end generatePreview*/

  // ─── Step 2: confirm and submit ───────────────────────────────────────────
  /**
   * Saves all non-excluded preview rows to Firestore shiftRequests collection
   * and triggers push notifications to eligible operators.
   */
  async function confirmAndSubmit(): Promise<void> {
    const activeRows = previewRows.value.filter((r) => !r.excluded);
    if (activeRows.length === 0) {
      $q.notify({ type: 'warning', message: 'Seleziona almeno un giorno da inviare' });
      return;
    }
    const configId = configStore.activeConfigId;
    if (!configId) {
      $q.notify({ type: 'warning', message: 'Nessuna configurazione attiva' });
      return;
    }
    const targetOperatorId = authStore.isAnyAdmin
      ? selectedOperatorId.value
      : (authStore.currentOperator?.id ?? '');
    if (!targetOperatorId) {
      $q.notify({ type: 'warning', message: 'Operatore non selezionato' });
      return;
    }

    submitting.value = true;
    try {
      const absentOperatorName = operators.value[targetOperatorId]?.name ?? 'Operatore';
      const creatorName =
        `${authStore.currentUser?.firstName ?? ''} ${authStore.currentUser?.lastName ?? ''}`.trim() ||
        'Utente';

      const batchData: Omit<ShiftRequest, 'id'>[] = activeRows.map((row) => ({
        date: row.date,
        originalShift: row.selectedShift,
        reason: 'ABSENCE' as RequestReason,
        status: 'OPEN',
        configId,
        creatorId: authStore.currentUser!.uid,
        creatorName,
        absentOperatorId: targetOperatorId,
        absentOperatorName,
        createdAt: Date.now(),
        requestNote: row.absenceLabel + (row.note ? ` - ${row.note}` : ''),
        ...(inputMode.value === 'TIME' && formData.value.startTime
          ? { startTime: formData.value.startTime }
          : {}),
        ...(inputMode.value === 'TIME' && formData.value.endTime
          ? { endTime: formData.value.endTime }
          : {}),
      }));

      const savedRefs = await Promise.all(
        batchData.map((req) => addDoc(collection(db, 'shiftRequests'), req)),
      );

      // Dynamic import to reduce initial bundle size
      const { notifyEligibleOperators } = await import('../services/NotificationService');
      for (let i = 0; i < savedRefs.length; i++) {
        const docRef = savedRefs[i];
        if (docRef?.id) {
          const fullReq = { ...batchData[i], id: docRef.id } as ShiftRequest;
          notifyEligibleOperators(fullReq, configId).catch((e: unknown) =>
            logger.error('Errore notifica operatori eleggibili', e),
          );
        }
      }

      $q.notify({
        type: 'positive',
        message:
          activeRows.length > 1
            ? `${activeRows.length} richieste inviate con successo`
            : 'Richiesta inviata con successo',
      });
      resetForm();
      onSuccess();
    } catch (e) {
      logger.error('Errore invio richieste assenza', e);
      $q.notify({ type: 'negative', message: "Errore durante l'invio" });
    } finally {
      submitting.value = false;
    }
  } /*end confirmAndSubmit*/

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function resetForm(): void {
    step.value = 'form';
    previewRows.value = [];
    formData.value.note = '';
    formData.value.startTime = '';
    formData.value.endTime = '';
    formData.value.isRecurring = false;
    if (authStore.isAnyAdmin) selectedOperatorId.value = '';
  } /*end resetForm*/

  function backToForm(): void {
    step.value = 'form';
  } /*end backToForm*/

  return {
    step,
    generatingPreview,
    submitting,
    selectedOperatorId,
    inputMode,
    formData,
    absenceOptions,
    shiftOptions,
    previewRows,
    previewActiveCount,
    filteredOperatorOptions,
    filterOperators,
    syncOperators,
    isAnyAdmin,
    generatePreview,
    confirmAndSubmit,
    resetForm,
    backToForm,
    formatToItalian,
  };
} /*end useAbsenceForm*/
