/**
 * @file RotationWidget.vue
 * @description Widget for operators to view their active shift rotation with premium design.
 * @author Nurse Hub Team
 * @created 2026-04-29
 * @modified 2026-05-03
 * @notes
 * - Standardized using AppDateInput and centralized locales.
 * - Ultra-compact next rotation section.
 * - Deeper grey and muted tones for future preview.
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import {
  collection, query, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { rotationService } from '../../services/RotationService';
import type { RotationGroup } from '../../types/models';
import { date as quasarDate, useQuasar } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import AppDateInput from '../common/AppDateInput.vue';

const $q = useQuasar();
const logger = useSecureLogger();
const authStore = useAuthStore();
const configStore = useConfigStore();

const userGroups = ref<RotationGroup[]>([]);
const loading = ref(true);
const expanded = ref(false);

const timerInterval = ref<ReturnType<typeof setInterval> | null>(null);
const now = ref(Date.now());
// Phase 36: track if an advance is in progress to prevent concurrent calls
const advancingGroupIds = ref<Set<string>>(new Set());

// Phase 36: real-time Firestore unsubscribe reference
let rotationUnsub: Unsubscribe | null = null;

const showTimerDialog = ref(false);
const selectedGroup = ref<RotationGroup | null>(null);
const nextDate = ref(''); // YYYY-MM-DD
const nextTime = ref('14:00');
const startColumnIndex = ref(0);
// Phase 36: interval between rotations (days)
const intervalDays = ref(5);

/**
 * Phase 36: Subscribe to real-time Firestore updates for the user's rotation groups.
 * Replaces the one-shot getDocs call so the widget reacts to changes from any device.
 */
function subscribeToGroups(configId: string): void {
  if (rotationUnsub) rotationUnsub();
  loading.value = true;

  const q = query(
    collection(db, `systemConfigurations/${configId}/rotationGroups`),
  );

  rotationUnsub = onSnapshot(q, (snap) => {
    const opId = authStore.currentOperator?.id || authStore.currentUser?.operatorId;
    const opName = authStore.currentOperator?.name;

    userGroups.value = snap.docs
      .map(d => d.data() as RotationGroup)
      .filter(g => g.operators.some(o =>
        (opName && o.operatorName.trim().toLowerCase() === opName.trim().toLowerCase()) ||
        (opId && o.operatorId === opId)
      ));
    loading.value = false;
    
    // Phase 38: Check immediately when data arrives to trigger rotation if due
    void checkAndAdvance();
  }, (err) => {
    logger.error('Failed to subscribe to rotation groups', err);
    loading.value = false;
  });
} /*end subscribeToGroups*/

/**
 * Phase 36: Clock Guard — called every 60s.
 * Checks if any active group has passed its nextChangeTimestamp
 * and advances it if so. Guards against concurrent advances.
 */
async function checkAndAdvance(): Promise<void> {
  const ts = Date.now();
  if (userGroups.value.length === 0) return;

  for (const group of userGroups.value) {
    if (
      group.isActive &&
      group.nextChangeTimestamp !== null &&
      ts >= group.nextChangeTimestamp &&
      !advancingGroupIds.value.has(group.id)
    ) {
      advancingGroupIds.value.add(group.id);
      try {
        logger.info('Clock Guard: advancing rotation', { groupId: group.id, step: group.currentColumnIndex });
        await rotationService.advanceGroup(group.configId, group);
        // onSnapshot will automatically update userGroups after Firestore write
      } catch (e) {
        logger.error('Clock Guard: advance failed', e);
      } finally {
        advancingGroupIds.value.delete(group.id);
      }
    }
  }
} /*end checkAndAdvance*/

onMounted(() => {
  const configId = authStore.currentUser?.configId || configStore.activeConfigId;
  if (configId) subscribeToGroups(configId);

  // Phase 38: Initial check to catch any expired timers immediately
  now.value = Date.now();
  void checkAndAdvance();

  timerInterval.value = setInterval(() => {
    now.value = Date.now();
    void checkAndAdvance(); // Phase 36: Clock Guard tick
  }, 60000);
});

watch(() => authStore.currentUser?.configId, (newId) => {
  if (newId) subscribeToGroups(newId);
});

onUnmounted(() => {
  if (timerInterval.value) clearInterval(timerInterval.value);
  if (rotationUnsub) rotationUnsub();
});

function formatTimeLeft(targetTs: number | null) {
  if (!targetTs) return 'Nessuna programmata';
  const diff = targetTs - now.value;
  if (diff <= 0) return 'Scaduto';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `tra ${days}g e ${hours}h` : `tra ${hours} ore`;
}

/**
 * Phase 36: Get operators for a specific column index relative to current.
 * @param offset - 0 for Active, 1 for Next (Timer), 2 for Following (+Interval)
 */
function getColumnOperators(group: RotationGroup, letter: 'A' | 'B', offset = 0): string[] {
  const totalCols = group.operators[0]?.pattern.length || 18;
  const col = (group.currentColumnIndex + offset) % totalCols;
  return group.operators.filter(o => o.pattern[col] === letter).map(o => o.operatorName);
}

/**
 * Phase 36: Calculate future date based on timer + interval offset.
 */
function getFutureDateStr(group: RotationGroup, offset = 1) {
  if (!group.nextChangeTimestamp) return 'TBD';
  const interval = group.intervalDays ?? 5;
  const addedTime = (offset - 1) * interval * 24 * 60 * 60 * 1000;
  return new Date(group.nextChangeTimestamp + addedTime).toLocaleDateString('it-IT');
}

function getNextDateStr(group: RotationGroup) {
  return getFutureDateStr(group, 1);
}

function openResumeDialog(group: RotationGroup) {
  selectedGroup.value = group;
  // Phase 36: The dialog sets the NEXT column, so default to current + 1
  const totalCols = group.operators[0]?.pattern.length || 18;
  startColumnIndex.value = (group.currentColumnIndex + 1) % totalCols;
  intervalDays.value = group.intervalDays ?? 5; // Phase 36: load saved interval
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  nextDate.value = quasarDate.formatDate(tomorrow, 'YYYY-MM-DD');
  showTimerDialog.value = true;
}

async function setNextTimer() {
  if (!selectedGroup.value || !nextDate.value || !nextTime.value) return;
  const dateTimeStr = `${nextDate.value}T${nextTime.value}:00`;
  const targetTs = new Date(dateTimeStr).getTime();
  if (targetTs <= Date.now()) {
    $q.notify({ type: 'warning', message: 'La data e ora devono essere nel futuro' });
    return;
  }

  const totalCols = selectedGroup.value.operators[0]?.pattern.length || 18;
  // Phase 36: startColumnIndex is the NEXT column the user wants to trigger.
  // Therefore, we must set the CURRENT column to startColumnIndex - 1.
  const newCurrentIndex = (startColumnIndex.value - 1 + totalCols) % totalCols;

  try {
    // Phase 36: save intervalDays alongside the timer
    await rotationService.updateTimerState(
      selectedGroup.value.configId,
      selectedGroup.value.id,
      true,
      newCurrentIndex,
      targetTs,
      intervalDays.value,
    );
    showTimerDialog.value = false;
    $q.notify({ type: 'positive', message: 'Timer programmato con successo' });
    // onSnapshot will refresh userGroups automatically
  } catch (e) { logger.error('Failed to set timer', e); }
}
</script>

<template>
  <div class="rotation-widget-container">
    <div v-if="loading" class="q-mb-md">
      <q-skeleton type="rect" height="48px" class="rounded-borders" />
    </div>

    <div v-else-if="userGroups.length > 0">
      <q-expansion-item
        v-model="expanded"
        icon="sync"
        label="Rotazione Setting"
        header-class="bg-blue-1 text-primary text-weight-bold"
        class="rounded-borders overflow-hidden shadow-1 q-mb-md"
      >
        <q-card flat class="q-mt-xs">
          <q-card-section class="q-pa-md">
            <div v-for="group in userGroups" :key="group.id" class="q-mb-md">
              <div class="row justify-between items-center q-mb-sm">
                <div class="column">
                  <div class="text-subtitle1 text-weight-bold text-primary">{{ group.name }}</div>
                  <div class="text-caption text-grey-7">
                    Step: <strong>{{ group.currentColumnIndex + 1 }}</strong> / {{ group.operators[0]?.pattern?.length || 18 }}
                  </div>
                </div>
                <q-badge :color="group.isActive ? 'positive' : 'grey-7'" size="sm"
                  :class="group.isActive ? 'badge-pulse' : ''">
                  {{ group.isActive ? 'Attivo' : 'Pausa' }}
                </q-badge>
              </div>

              <!-- PREMIUM SETTING CARDS (CURRENT) -->
              <div class="row q-col-gutter-sm q-mb-sm">
                <div v-for="letter in (['A', 'B'] as const)" :key="letter" class="col-6">
                  <q-card flat bordered class="setting-premium-card" :class="letter === 'A' ? 'border-amber' : 'border-blue'">
                    <q-card-section class="q-pa-sm row no-wrap items-center bg-grey-1 border-bottom">
                      <div class="shift-display-mini column items-center q-mr-sm">
                        <div class="shift-letter-mini text-weight-bold" :style="{ color: letter === 'A' ? '#f59e0b' : '#1e3a8a' }">
                          {{ letter }}
                        </div>
                        <q-icon :name="letter === 'A' ? 'stars' : 'settings'" :style="{ color: letter === 'A' ? '#f59e0b' : '#1e3a8a' }" size="10px" />
                      </div>
                      <div class="column">
                        <span class="text-weight-bolder text-grey-9" style="font-size: 0.75rem">Setting {{ letter }}</span>
                      </div>
                    </q-card-section>
                    <q-card-section class="q-pa-xs roster-mini">
                      <div v-for="name in getColumnOperators(group, letter)" :key="name" class="text-caption text-grey-9 q-px-xs">
                        • {{ name }}
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </div>

              <!-- NEXT ROTATION PREVIEW (ULTRA COMPACT) -->
              <div class="next-rotation-container q-mt-sm q-pa-xs rounded-borders bg-grey-3">
                <div class="row items-center justify-between q-px-xs q-mb-xs">
                  <span class="text-caption text-grey-8 text-weight-bold" style="font-size: 0.65rem">
                    🔜 PROSSIMO: {{ getNextDateStr(group) }}
                    <span v-if="group.intervalDays" class="text-grey-6"> · ogni {{ group.intervalDays }}g</span>
                  </span>
                  <span class="text-caption text-grey-7" style="font-size: 0.6rem">{{ formatTimeLeft(group.nextChangeTimestamp) }}</span>
                </div>

                <!-- FIRST FUTURE STEP (Programmed) -->
                <div class="row q-col-gutter-xs opacity-80 grayscale-light q-mb-xs">
                  <div v-for="nextLetter in (['A', 'B'] as const)" :key="'next-' + nextLetter" class="col-6">
                    <q-card flat bordered class="setting-premium-card mini-card" :class="nextLetter === 'A' ? 'border-amber-thin' : 'border-blue-thin'">
                      <q-card-section class="q-pa-xs row no-wrap items-center bg-grey-4 border-bottom">
                        <div class="shift-letter-ultra-mini text-weight-bold q-mr-xs" :style="{ color: nextLetter === 'A' ? '#d97706' : '#1e3a8a' }">
                          {{ nextLetter }}
                        </div>
                        <span class="text-weight-bold text-grey-9" style="font-size: 0.6rem">Set {{ nextLetter }}</span>
                      </q-card-section>
                      <q-card-section class="q-pa-xs roster-mini-dense">
                        <div v-for="nextName in getColumnOperators(group, nextLetter, 1)" :key="'next-name-' + nextName" class="text-grey-9 q-px-xs" style="font-size: 0.55rem; line-height: 1.2">
                          • {{ nextName }}
                        </div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>

                <!-- SECOND FUTURE STEP (Automatic Follow-up) -->
                <div class="following-rotation q-pt-xs border-top-dashed">
                  <div class="text-caption text-grey-7 q-px-xs q-mb-xs" style="font-size: 0.6rem; font-style: italic;">
                    ➡️ SUCCESSIVO: {{ getFutureDateStr(group, 2) }}
                  </div>
                  <div class="row q-col-gutter-xs opacity-60 grayscale">
                    <div v-for="folLetter in (['A', 'B'] as const)" :key="'fol-' + folLetter" class="col-6">
                      <div class="row no-wrap items-center q-px-xs">
                         <div class="text-weight-bold q-mr-xs" :style="{ color: folLetter === 'A' ? '#d97706' : '#1e3a8a', fontSize: '0.55rem' }">{{ folLetter }}</div>
                         <div class="column">
                           <div v-for="folName in getColumnOperators(group, folLetter, 2)" :key="'fol-name-' + folName" class="text-grey-8" style="font-size: 0.5rem; line-height: 1.1">
                             {{ folName }}
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="row q-gutter-x-xs justify-end q-mt-sm">
                <q-btn flat dense color="primary" label="Gestisci Timer" size="sm" icon="edit_calendar" @click="openResumeDialog(group)" />
              </div>
              <q-separator class="q-mt-sm" v-if="userGroups.length > 1" />
            </div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </div>

    <!-- Dialog for Set Timer -->
    <q-dialog v-model="showTimerDialog" persistent>
      <q-card style="min-width: 320px" class="rounded-borders shadow-2">
        <q-card-section class="bg-primary text-white q-py-sm row items-center no-wrap">
          <q-icon name="schedule" class="q-mr-sm" />
          <div class="text-subtitle1">Programma Cambio</div>
        </q-card-section>

        <q-card-section class="q-gutter-y-md q-pt-md">
          <!-- Standardized Date Picker -->
          <AppDateInput
            v-model="nextDate"
            label="Data Cambio"
            hint="Clicca per aprire il calendario"
          />

          <!-- Time Picker -->
          <q-input dense filled v-model="nextTime" label="Ora Cambio" hint="Format: 24h" mask="time">
            <template v-slot:append>
              <q-icon name="access_time" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-time v-model="nextTime" format24h>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Ok" color="primary" flat />
                    </div>
                  </q-time>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>

          <!-- Phase 36: Interval days between rotations -->
          <q-input
            dense filled
            v-model.number="intervalDays"
            type="number"
            label="Ogni quanti giorni avanzare"
            hint="Es. 5 = avanza ogni 5 giorni"
            :min="1" :max="30"
          />

          <q-select dense filled v-model="startColumnIndex" label="Ripartenza da Colonna (Prossimo Step)"
            :options="Array.from({length: selectedGroup?.operators[0]?.pattern.length || 18}, (_, i) => ({ label: `Colonna ${i + 1}`, value: i }))"
            emit-value map-options />
        </q-card-section>

        <q-card-actions align="right" class="q-pb-md q-pr-md">
          <q-btn flat label="Annulla" v-close-popup color="grey-7" size="sm" />
          <q-btn unelevated color="primary" label="Salva Timer" @click="setNextTimer" size="sm" class="rounded-borders" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.setting-premium-card {
  border-radius: 10px;
  overflow: hidden;
}

.mini-card {
  border-radius: 6px;
  background: #f8fafc;
}

.border-amber { border-top: 3px solid #f59e0b; }
.border-blue { border-top: 3px solid #1e3a8a; }

.border-amber-thin { border-top: 2px solid #d97706; }
.border-blue-thin { border-top: 2px solid #1e3a8a; }

.border-bottom { border-bottom: 1px solid #f1f5f9; }

.shift-letter-mini { font-size: 1.2rem; line-height: 1; }
.shift-letter-ultra-mini { font-size: 0.85rem; line-height: 1; }

.roster-mini { max-height: 100px; overflow-y: auto; }
.roster-mini-dense { max-height: 60px; overflow-y: auto; }

.opacity-70 { opacity: 0.7; }
.grayscale-light { filter: grayscale(0.2); }

.next-rotation-container {
  border: 1px solid #e2e8f0;
}

.border-top-dashed {
  border-top: 1px dashed #cbd5e1;
}

.opacity-80 { opacity: 0.8; }
.opacity-60 { opacity: 0.6; }
.grayscale { filter: grayscale(0.5); }

/* Pulse animation for the active-rotation badge */
@keyframes badge-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}
.badge-pulse {
  animation: badge-pulse 1.8s ease-in-out infinite;
  display: inline-flex;
}

/* Custom Scrollbar */
.roster-mini::-webkit-scrollbar,
.roster-mini-dense::-webkit-scrollbar {
  width: 3px;
}
.roster-mini::-webkit-scrollbar-thumb,
.roster-mini-dense::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
