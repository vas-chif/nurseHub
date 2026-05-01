/**
 * @file RotationWidget.vue
 * @description Widget for operators to view their active shift rotation and manage the timer.
 * @author Nurse Hub Team
 * @created 2026-04-29
 * @modified 2026-04-29
 * @notes
 * - Fetches RotationGroups that the current user belongs to.
 * - Displays the current state (column in the matrix).
 * - Allows users to pause or resume/set the next cycle timer.
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { rotationService } from '../../services/RotationService';
import type { RotationGroup } from '../../types/models';
import { useQuasar, date as quasarDate } from 'quasar';
import { useSecureLogger } from '../../utils/secureLogger';

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();

const userGroups = ref<RotationGroup[]>([]);
const loading = ref(true);

const expanded = ref(false);

const timerInterval = ref<NodeJS.Timeout | null>(null);
const now = ref(Date.now());

// Dialog for setting next timestamp
const showTimerDialog = ref(false);
const selectedGroup = ref<RotationGroup | null>(null);
const nextDate = ref('');
const nextTime = ref('14:00');
const startColumnIndex = ref(0);

async function loadMyGroups() {
  // Identity fencing: always use the user's own configId for the rotation widget.
  // Do NOT use configStore.activeConfigId (volatile Maestro Filter for SuperAdmin).
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
  timerInterval.value = setInterval(() => {
    now.value = Date.now();
  }, 60000); // Update relative times every minute
});

// Re-try loading if user profile arrives late (async auth initialization)
watch(
  () => authStore.currentUser?.configId,
  (newConfigId) => {
    if (newConfigId && userGroups.value.length === 0) {
      void loadMyGroups();
    }
  },
);

onUnmounted(() => {
  if (timerInterval.value) clearInterval(timerInterval.value);
});

function formatTimeLeft(targetTs: number | null) {
  if (!targetTs) return 'Nessuna rotazione programmata';
  const diff = targetTs - now.value;
  if (diff <= 0) return 'Scaduto (In attesa di aggiornamento...)';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `tra ${days} giorni e ${hours} ore`;
  if (hours > 0) return `tra ${hours} ore`;
  return `tra meno di un'ora`;
}

function getColumnA(group: RotationGroup, isNext = false): string[] {
  let col = group.currentColumnIndex;
  if (isNext) {
    const totalCols = group.operators[0]?.pattern.length || 18;
    col = (col + 1) % totalCols;
  }
  return group.operators.filter(o => o.pattern[col] === 'A').map(o => o.operatorName);
}

function getColumnB(group: RotationGroup, isNext = false): string[] {
  let col = group.currentColumnIndex;
  if (isNext) {
    const totalCols = group.operators[0]?.pattern.length || 18;
    col = (col + 1) % totalCols;
  }
  return group.operators.filter(o => o.pattern[col] === 'B').map(o => o.operatorName);
}

function getNextDateStr(group: RotationGroup) {
  if (!group.nextChangeTimestamp) return 'TBD';
  // Assuming rotation is every 5 days based on script logic
  const nextChange = new Date(group.nextChangeTimestamp);
  return nextChange.toLocaleDateString('it-IT');
}

function pauseRotation(group: RotationGroup) {
  $q.dialog({
    title: 'Sospendi Rotazione',
    message: 'Vuoi mettere in pausa il timer (es. per periodo Fuori Turno estivo)? Le notifiche verranno sospese.',
    cancel: true,
    persistent: true
  }).onOk(() => {
    void (async () => {
      try {
        await rotationService.updateTimerState(group.configId, group.id, false, group.currentColumnIndex, null);
        $q.notify({ type: 'info', message: 'Rotazione messa in pausa' });
        void loadMyGroups();
      } catch (error) {
        logger.error('Failed to pause rotation', error);
        $q.notify({ type: 'negative', message: 'Errore durante la sospensione' });
      }
    })();
  });
}

function openResumeDialog(group: RotationGroup) {
  selectedGroup.value = group;
  startColumnIndex.value = group.currentColumnIndex;
  // Pre-fill tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  nextDate.value = quasarDate.formatDate(tomorrow, 'YYYY/MM/DD');
  showTimerDialog.value = true;
}

async function setNextTimer() {
  if (!selectedGroup.value || !nextDate.value || !nextTime.value) return;
  
  const dateTimeStr = `${nextDate.value.replace(/\//g, '-')}T${nextTime.value}:00`;
  const targetTs = new Date(dateTimeStr).getTime();
  
  if (targetTs <= Date.now()) {
    $q.notify({ type: 'warning', message: 'Seleziona una data e ora futura' });
    return;
  }
  
  try {
    await rotationService.updateTimerState(
      selectedGroup.value.configId,
      selectedGroup.value.id,
      true,
      startColumnIndex.value,
      targetTs
    );
    $q.notify({ type: 'positive', message: 'Nuovo timer impostato con successo!' });
    showTimerDialog.value = false;
    void loadMyGroups();
  } catch (error) {
    logger.error('Failed to set next timer', error);
    $q.notify({ type: 'negative', message: 'Errore di salvataggio' });
  }
}
</script>

<template>
  <div>
    <!-- Skeleton Loading State -->
    <div v-if="loading" class="q-mb-md">
      <q-card flat bordered class="rounded-borders overflow-hidden shadow-1">
        <q-item class="bg-blue-1 q-pa-md">
          <q-item-section avatar>
            <q-skeleton type="QAvatar" size="24px" />
          </q-item-section>
          <q-item-section>
            <q-skeleton type="text" width="50%" class="text-subtitle1" />
          </q-item-section>
          <q-item-section side>
            <q-skeleton type="QBtn" size="sm" />
          </q-item-section>
        </q-item>
      </q-card>
    </div>

    <!-- Active Content -->
    <div v-else-if="userGroups.length > 0">
      <q-expansion-item
        v-model="expanded"
        icon="sync"
        label="Rotazione Setting"
        header-class="bg-blue-1 text-primary text-weight-bold"
        class="rounded-borders overflow-hidden shadow-1 q-mb-md"
      >
      <q-card>
        <q-card-section>
          <div v-for="group in userGroups" :key="group.id" class="q-mb-md">
            <div class="row justify-between items-center q-mb-md">
              <div class="column">
                <div class="text-h6 text-primary">{{ group.name }}</div>
                <div class="text-caption text-grey-7">
                  Colonna Attuale: <q-badge outline color="primary" label="Index" class="q-mr-xs" /> <strong>{{ group.currentColumnIndex + 1 }}</strong> / {{ group.operators[0]?.pattern?.length || 18 }}
                </div>
              </div>
              <q-badge :color="group.isActive ? 'positive' : 'grey-7'" class="q-pa-sm text-uppercase text-weight-bold" rounded>
                <q-icon :name="group.isActive ? 'check_circle' : 'pause_circle'" class="q-mr-xs" />
                {{ group.isActive ? 'Attivo' : 'Sospeso' }}
              </q-badge>
            </div>

            <!-- SECTION: CURRENT ROTATION -->
            <div class="rotation-section q-mb-lg">
              <div class="text-overline text-grey-8 q-mb-xs">Turnazione Attuale (Oggi)</div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-6">
                  <div class="setting-card setting-a q-pa-md rounded-borders shadow-1 bg-amber-1 border-amber-3">
                    <div class="row items-center q-mb-sm">
                      <q-avatar size="28px" font-size="16px" color="amber-8" text-white class="q-mr-sm">A</q-avatar>
                      <div class="text-subtitle2 text-amber-10">Setting A</div>
                    </div>
                    <div class="row q-gutter-xs">
                      <q-chip v-for="name in getColumnA(group)" :key="name" 
                        dense color="amber-2" text-color="amber-10" class="text-weight-bold">
                        {{ name }}
                      </q-chip>
                      <div v-if="getColumnA(group).length === 0" class="text-caption text-grey-6">Nessuno</div>
                    </div>
                  </div>
                </div>
                <div class="col-12 col-md-6">
                  <div class="setting-card setting-b q-pa-md rounded-borders shadow-1 bg-blue-1 border-blue-3">
                    <div class="row items-center q-mb-sm">
                      <q-avatar size="28px" font-size="16px" color="blue-8" text-white class="q-mr-sm">B</q-avatar>
                      <div class="text-subtitle2 text-blue-10">Setting B</div>
                    </div>
                    <div class="row q-gutter-xs">
                      <q-chip v-for="name in getColumnB(group)" :key="name" 
                        dense color="blue-2" text-color="blue-10" class="text-weight-bold">
                        {{ name }}
                      </q-chip>
                      <div v-if="getColumnB(group).length === 0" class="text-caption text-grey-6">Nessuno</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION: NEXT ROTATION -->
            <div class="rotation-section next-rotation q-mb-lg border-dashed q-pa-sm rounded-borders bg-grey-1">
              <div class="row items-center justify-between q-mb-sm">
                <div class="text-overline text-grey-7">🔜 Prossima Turnazione (nr {{ (group.currentColumnIndex + 1) % (group.operators[0]?.pattern.length || 18) + 1 }})</div>
                <div class="text-caption text-weight-bold text-primary">{{ getNextDateStr(group) }}</div>
              </div>
              <div class="row q-col-gutter-md opacity-70">
                <div class="col-6">
                  <div class="text-caption text-weight-bold q-mb-xs"><q-icon name="arrow_right" color="amber-8" /> Setting A</div>
                  <div class="row q-gutter-xs">
                    <q-badge v-for="name in getColumnA(group, true)" :key="name" 
                      color="amber-7" label="" class="q-px-sm">
                      {{ name }}
                    </q-badge>
                  </div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-weight-bold q-mb-xs"><q-icon name="arrow_right" color="blue-8" /> Setting B</div>
                  <div class="row q-gutter-xs">
                    <q-badge v-for="name in getColumnB(group, true)" :key="name" 
                      color="blue-7" label="" class="q-px-sm">
                      {{ name }}
                    </q-badge>
                  </div>
                </div>
              </div>
            </div>

            <!-- Timer Info -->
            <q-banner v-if="group.isActive" rounded class="bg-orange-1 text-orange-10 q-mb-md" dense bordered>
              <template v-slot:avatar>
                <q-icon name="schedule" color="orange-8" />
              </template>
              <div class="text-body2">
                Prossimo cambio automatico: <strong>{{ formatTimeLeft(group.nextChangeTimestamp) }}</strong>
              </div>
              <div class="text-caption" v-if="group.nextChangeTimestamp">
                {{ new Date(group.nextChangeTimestamp).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }}
              </div>
            </q-banner>

            <!-- Actions -->
            <div class="row q-gutter-sm justify-end">
              <q-btn 
                v-if="group.isActive"
                flat color="negative" icon="pause_circle" label="Sospendi" size="sm" 
                class="rounded-borders"
                @click="pauseRotation(group)" 
              />
              <q-btn 
                unelevated
                color="primary" icon="update" 
                :label="group.isActive ? 'Sposta Sveglia' : 'Riprendi Turnazione'" size="sm" 
                class="rounded-borders text-weight-bold"
                @click="openResumeDialog(group)" 
              />
            </div>
            
            <q-separator class="q-mt-lg" v-if="userGroups.length > 1" />
          </div>
        </q-card-section>
      </q-card>
    </q-expansion-item>

    <!-- Dialog for Set Timer -->
    <q-dialog v-model="showTimerDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="bg-primary text-white">
          <div class="text-h6">Imposta Prossimo Cambio</div>
        </q-card-section>

        <q-card-section class="q-gutter-md q-pt-md">
          <div class="text-caption text-grey-8">
            Seleziona la data e l'ora esatta in cui il sistema scatterà e avviserà il gruppo del prossimo cambio (e ricomincerà a contare i 5 giorni).
          </div>

          <!-- Date Picker -->
          <q-input filled v-model="nextDate" mask="date" :rules="['date']" label="Data del Cambio">
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="nextDate">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Chiudi" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>

          <!-- Time Picker -->
          <q-input filled v-model="nextTime" mask="time" :rules="['time']" label="Ora del Cambio">
            <template v-slot:append>
              <q-icon name="access_time" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-time v-model="nextTime" format24h>
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Chiudi" color="primary" flat />
                    </div>
                  </q-time>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>

          <!-- Column Override -->
          <q-select 
            v-if="selectedGroup"
            filled 
            v-model="startColumnIndex" 
            :options="Array.from({length: selectedGroup.operators[0]?.pattern.length || 18}, (_, i) => ({ label: `Colonna ${i + 1}`, value: i }))"
            emit-value
            map-options
            label="Da quale colonna si riparte?" 
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Annulla" v-close-popup />
          <q-btn flat label="Imposta Timer" @click="setNextTimer" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    </div>
  </div>
</template>
<style scoped lang="scss">
.setting-card {
  height: 100%;
  border: 1px solid transparent;
  transition: all 0.3s ease;
  
  &.setting-a {
    border-color: #ffe082;
  }
  &.setting-b {
    border-color: #90caf9;
  }
}

.rotation-section {
  &.next-rotation {
    border: 1px dashed #e0e0e0;
  }
}

.opacity-70 {
  opacity: 0.7;
}

.border-dashed {
  border-style: dashed !important;
}
</style>
