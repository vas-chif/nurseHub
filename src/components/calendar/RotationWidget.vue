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
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { rotationService } from '../../services/RotationService';
import type { RotationGroup } from '../../types/models';
import { date as quasarDate } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';
import AppDateInput from '../common/AppDateInput.vue';

const logger = useSecureLogger();
const authStore = useAuthStore();
const configStore = useConfigStore();

const userGroups = ref<RotationGroup[]>([]);
const loading = ref(true);
const expanded = ref(false);

const timerInterval = ref<NodeJS.Timeout | null>(null);
const now = ref(Date.now());

const showTimerDialog = ref(false);
const selectedGroup = ref<RotationGroup | null>(null);
const nextDate = ref(''); // YYYY-MM-DD
const nextTime = ref('14:00');
const startColumnIndex = ref(0);

async function loadMyGroups() {
  const configId = authStore.currentUser?.configId || configStore.activeConfigId;
  if (!configId || !authStore.currentUser) return;
  
  loading.value = true;
  try {
    const allGroups = await rotationService.getGroups(configId);
    const opId = authStore.currentOperator?.id || authStore.currentUser.operatorId;
    const opName = authStore.currentOperator?.name;

    userGroups.value = allGroups.filter(g => {
      return g.operators.some(o => 
        (opName && o.operatorName.trim().toLowerCase() === opName.trim().toLowerCase()) || 
        (opId && o.operatorId === opId)
      );
    });
  } catch (e) {
    logger.error('Failed to load user rotation groups', e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadMyGroups();
  timerInterval.value = setInterval(() => { now.value = Date.now(); }, 60000);
});

watch(() => authStore.currentUser?.configId, (newId) => {
  if (newId && userGroups.value.length === 0) void loadMyGroups();
});

onUnmounted(() => { if (timerInterval.value) clearInterval(timerInterval.value); });

function formatTimeLeft(targetTs: number | null) {
  if (!targetTs) return 'Nessuna programmata';
  const diff = targetTs - now.value;
  if (diff <= 0) return 'Scaduto';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `tra ${days}g e ${hours}h` : `tra ${hours} ore`;
}

function getColumnOperators(group: RotationGroup, letter: 'A' | 'B', isNext = false): string[] {
  let col = group.currentColumnIndex;
  if (isNext) {
    const totalCols = group.operators[0]?.pattern.length || 18;
    col = (col + 1) % totalCols;
  }
  return group.operators.filter(o => o.pattern[col] === letter).map(o => o.operatorName);
}

function getNextDateStr(group: RotationGroup) {
  if (!group.nextChangeTimestamp) return 'TBD';
  return new Date(group.nextChangeTimestamp).toLocaleDateString('it-IT');
}

function openResumeDialog(group: RotationGroup) {
  selectedGroup.value = group;
  startColumnIndex.value = group.currentColumnIndex;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  nextDate.value = quasarDate.formatDate(tomorrow, 'YYYY-MM-DD');
  showTimerDialog.value = true;
}

async function setNextTimer() {
  if (!selectedGroup.value || !nextDate.value || !nextTime.value) return;
  const dateTimeStr = `${nextDate.value}T${nextTime.value}:00`;
  const targetTs = new Date(dateTimeStr).getTime();
  if (targetTs <= Date.now()) return;
  try {
    await rotationService.updateTimerState(selectedGroup.value.configId, selectedGroup.value.id, true, startColumnIndex.value, targetTs);
    showTimerDialog.value = false;
    void loadMyGroups();
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
                <q-badge :color="group.isActive ? 'positive' : 'grey-7'" size="sm">
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
                  <span class="text-caption text-grey-8 text-weight-bold" style="font-size: 0.65rem">🔜 PROSSIMO: {{ getNextDateStr(group) }}</span>
                  <span class="text-caption text-grey-7" style="font-size: 0.6rem">{{ formatTimeLeft(group.nextChangeTimestamp) }}</span>
                </div>

                <div class="row q-col-gutter-xs opacity-70 grayscale-light">
                  <div v-for="nextLetter in (['A', 'B'] as const)" :key="'next-' + nextLetter" class="col-6">
                    <q-card flat bordered class="setting-premium-card mini-card" :class="nextLetter === 'A' ? 'border-amber-thin' : 'border-blue-thin'">
                      <q-card-section class="q-pa-xs row no-wrap items-center bg-grey-4 border-bottom">
                        <div class="shift-letter-ultra-mini text-weight-bold q-mr-xs" :style="{ color: nextLetter === 'A' ? '#d97706' : '#1e3a8a' }">
                          {{ nextLetter }}
                        </div>
                        <span class="text-weight-bold text-grey-9" style="font-size: 0.6rem">Set {{ nextLetter }}</span>
                      </q-card-section>
                      <q-card-section class="q-pa-xs roster-mini-dense">
                        <div v-for="nextName in getColumnOperators(group, nextLetter, true)" :key="'next-name-' + nextName" class="text-grey-9 q-px-xs" style="font-size: 0.55rem; line-height: 1.2">
                          • {{ nextName }}
                        </div>
                      </q-card-section>
                    </q-card>
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

          <q-select dense filled v-model="startColumnIndex" label="Ripartenza da Colonna" 
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
