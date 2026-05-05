/**
 * @file SwapOpportunitiesCard.vue
 * @description Dashboard component for browsing and accepting shift swap proposals from colleagues.
 * @author Nurse Hub Team
 * @created 2026-03-12
 * @modified 2026-05-03
 * @notes
 * - Filters swaps based on compatibility with user's own schedule.
 * - Implements "Not Interested" logic and ignored proposals section.
 * - Supports sorting by creation date or shift date.
 */
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import { useSecureLogger } from '../../utils/secureLogger';
import { notifyUser, notifyAdmins } from '../../services/NotificationService';
import type { ShiftSwap, ShiftSwapStatus } from '../../types/models';
import { useShiftLogic } from '../../composables/useShiftLogic';

const logger = useSecureLogger();
const $q = useQuasar();
const authStore = useAuthStore();
const configStore = useConfigStore();
const { isRequestExpired } = useShiftLogic();

const loading = ref(false);
const accepting = ref<Record<string, boolean>>({});
const compatibleSwaps = ref<ShiftSwap[]>([]);
const myAcceptedSwaps = ref<ShiftSwap[]>([]);
const ignoredSwaps = ref<ShiftSwap[]>([]);

// Sorting & Interest
const sortBy = ref<'created' | 'date'>('created');
const sortOptions = [
  { label: 'Più recenti', value: 'created', icon: 'new_releases' },
  { label: 'Data Turno', value: 'date', icon: 'calendar_today' },
];

const shiftColorMap: Record<string, string> = {
  M: 'amber-9',
  P: 'deep-orange-6',
  N: 'blue-8',
  S: 'teal-7',
  R: 'green-7',
  MP: 'purple-7',
};

function getShiftColor(shift: string): string {
  return shiftColorMap[shift] ?? 'grey-7';
}

function formatDate(dt: string): string {
  return qDate.formatDate(dt, 'DD/MM/YYYY (ddd)');
}

function getSwapStatusColor(status: ShiftSwapStatus): string {
  const map: Record<ShiftSwapStatus, string> = {
    OPEN: 'primary',
    MATCHED: 'warning',
    PENDING_ADMIN: 'orange',
    APPROVED: 'positive',
    REJECTED: 'negative',
  };
  return map[status] ?? 'grey';
}

function getSwapStatusLabel(status: ShiftSwapStatus): string {
  const map: Record<ShiftSwapStatus, string> = {
    OPEN: 'Aperta',
    MATCHED: 'Accordo',
    PENDING_ADMIN: 'In revisione',
    APPROVED: 'Approvata',
    REJECTED: 'Rifiutata',
  };
  return map[status] ?? status;
}

onMounted(() => {
  void loadAll();
});

watch(sortBy, () => {
  void loadOpportunities();
});

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadOpportunities(), loadMyAcceptedSwaps(), loadIgnored()]);
  } finally {
    loading.value = false;
  }
}

async function loadOpportunities() {
  const uid = authStore.currentUser?.uid;
  const operatorSchedule = authStore.currentOperator?.schedule;
  if (!uid) return;

  const snap = await getDocs(query(collection(db, 'shiftSwaps'), where('status', '==', 'OPEN')));
  const allOpen = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShiftSwap))
    .filter((s) => s.creatorId !== uid);

  compatibleSwaps.value = allOpen.filter((swap) => {
    if (!operatorSchedule) return false;
    // B must have desiredShift on desiredDate (the date A wants)
    const isCompatible = operatorSchedule[swap.desiredDate] === swap.desiredShift;
    // B must be free (R/A) on swap.date so they can take A's offered shift
    const offeredDateShift = operatorSchedule[swap.date] ?? 'R';
    const isFreeOnOfferedDate = !['M', 'P', 'N', 'S', 'MP', 'N11', 'N12'].includes(offeredDateShift);
    // Interest check
    const isHidden = swap.hiddenBy?.includes(uid) || false;
    // Expiration check
    const isExpired = isRequestExpired(swap.date, swap.offeredShift);
    
    return isCompatible && isFreeOnOfferedDate && !isHidden && !isExpired;
  });

  // Sorting
  if (sortBy.value === 'created') {
    compatibleSwaps.value.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    compatibleSwaps.value.sort((a, b) => a.date.localeCompare(b.date));
  }
}

async function loadIgnored() {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;
  const snap = await getDocs(query(collection(db, 'shiftSwaps'), where('status', '==', 'OPEN')));
  ignoredSwaps.value = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as ShiftSwap))
    .filter((s) => s.hiddenBy?.includes(uid));
}

async function loadMyAcceptedSwaps() {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;
  const snap = await getDocs(
    query(
      collection(db, 'shiftSwaps'),
      where('counterpartId', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  myAcceptedSwaps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShiftSwap));
}

async function toggleInterest(swapId: string, interested: boolean) {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;

  try {
    const swapRef = doc(db, 'shiftSwaps', swapId);
    if (!interested) {
      await updateDoc(swapRef, { hiddenBy: arrayUnion(uid) });
      $q.notify({ message: 'Spostato nei cambi ignorati', color: 'grey-7', icon: 'visibility_off', timeout: 1000 });
    } else {
      await updateDoc(swapRef, { hiddenBy: arrayRemove(uid) });
      $q.notify({ message: 'Ripristinato', color: 'primary', icon: 'visibility', timeout: 1000 });
    }
    void loadAll();
  } catch (e) {
    logger.error('Error toggling interest', e);
  }
}

function acceptSwap(swap: ShiftSwap) {
  const uid = authStore.currentUser?.uid;
  const operatorId = authStore.currentOperator?.id;
  if (!uid || !operatorId) {
    $q.notify({ type: 'warning', message: 'Profilo operatore non collegato' });
    return;
  }

  $q.dialog({
    title: '<span class="text-primary text-weight-bold">Accetta Proposta di Cambio</span>',
    message: `
      <div style="font-family: inherit;">
        <p style="margin-bottom: 16px; font-size: 1.1em;">Confermi di accettare il cambio per il giorno <br><strong>${formatDate(swap.date)}</strong>?</p>

        <div style="display: flex; align-items: center; justify-content: space-around; background: #f8f9fa; padding: 20px; border-radius: 15px; margin-bottom: 16px; border: 1px solid #e9ecef;">
          <div style="text-align: center;">
            <div style="font-size: 0.75em; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Cederai</div>
            <div style="font-size: 2em; font-weight: 800; color: #d32f2f;">${swap.desiredShift}</div>
          </div>

          <div style="font-size: 2.5em; color: #1976d2; opacity: 0.7;">⇄</div>

          <div style="text-align: center;">
            <div style="font-size: 0.75em; color: #6c757d; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Riceverai</div>
            <div style="font-size: 2em; font-weight: 800; color: #2e7d32;">${swap.offeredShift}</div>
          </div>
        </div>

        <div style="font-size: 0.85em; color: #757575; display: flex; align-items: center; padding: 8px; background: #e3f2fd; border-radius: 8px;">
          <span style="margin-right: 8px; font-size: 1.2em;">ℹ️</span>
          La proposta sarà inviata all'admin per l'approvazione finale.
        </div>
      </div>
    `,
    html: true,
    cancel: {
      flat: true,
      color: 'grey-7',
      label: 'Annulla'
    },
    ok: {
      unelevated: true,
      color: 'primary',
      label: 'Conferma Scambio'
    },
    persistent: true,
  }).onOk(() => {
    void (async () => {
      accepting.value[swap.id] = true;
      try {
        const counterpartName =
          `${authStore.currentUser?.firstName || ''} ${authStore.currentUser?.lastName || ''}`.trim() ||
          'Collega';

        await updateDoc(doc(db, 'shiftSwaps', swap.id), {
          status: 'PENDING_ADMIN',
          counterpartId: uid,
          counterpartOperatorId: operatorId,
          counterpartName,
          matchedAt: Date.now(),
        });

        // Notify the original creator that someone accepted
        void notifyUser(
          swap.creatorId,
          'SWAP_MATCHED',
          `${counterpartName} ha accettato il tuo cambio del ${formatDate(swap.date)}. Attendi l'approvazione del coordinatore.`,
          swap.id,
        );

        // Notify admins that there's a match to review
        if (configStore.activeConfigId) {
          void notifyAdmins(
            `Accordo raggiunto tra ${swap.creatorName} e ${counterpartName} per il ${formatDate(swap.date)}. In attesa di revisione.`,
            swap.id,
            configStore.activeConfigId,
          );
        }

        $q.notify({
          type: 'positive',
          message: 'Proposta accettata! In attesa di approvazione admin.',
          icon: 'handshake',
        });
        compatibleSwaps.value = compatibleSwaps.value.filter((s) => s.id !== swap.id);
        // Reload accepted swaps to show it as PENDING_ADMIN in the dashboard
        await loadMyAcceptedSwaps();
      } catch (e) {
        logger.error('Error accepting swap', e);
        $q.notify({ type: 'negative', message: "Errore durante l'accettazione" });
      } finally {
        accepting.value[swap.id] = false;
      }
    })();
  });
}
</script>

<template>
  <q-card flat bordered class="q-mt-md">
    <!-- ===== Header ===== -->
    <q-card-section class="q-pb-none">
      <div class="row items-center justify-between no-wrap">
        <div class="row items-center q-gutter-x-sm">
          <div class="text-subtitle1 text-weight-bold">
            <q-icon name="swap_horiz" color="primary" class="q-mr-xs" />
            Cambi Turno
          </div>
          <q-btn-dropdown flat dense size="sm" color="grey-7" :icon="sortOptions.find(o => o.value === sortBy)?.icon">
            <q-list dense>
              <q-item v-for="opt in sortOptions" :key="opt.value" clickable v-close-popup @click="sortBy = opt.value as 'created' | 'date'">
                <q-item-section avatar>
                  <q-icon :name="opt.icon" size="xs" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="sortBy === opt.value">
                  <q-icon name="check" color="primary" size="xs" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
        <q-btn flat round dense icon="refresh" size="sm" :loading="loading" @click="loadAll">
          <q-tooltip>Aggiorna</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-card-section>
      <!-- ===== SEZIONE 1: Proposte di colleghi compatibili ===== -->
      <div class="text-caption text-weight-bold text-grey-8 q-mb-sm">
        <q-icon name="group" size="xs" class="q-mr-xs" />
        Proposte disponibili per te
      </div>

      <div v-if="loading" class="q-gutter-xs q-mb-md">
        <q-card v-for="n in 2" :key="n" flat class="q-pa-sm bg-blue-1 rounded-borders">
          <div class="row items-center justify-between">
            <div class="col">
              <q-skeleton type="text" width="30%" class="q-mb-xs" />
              <div class="row items-center q-gutter-xs">
                <q-skeleton type="rect" width="30px" height="20px" />
                <q-skeleton type="text" width="40px" />
                <q-skeleton type="rect" width="30px" height="20px" />
              </div>
            </div>
            <q-skeleton type="rect" width="60px" height="28px" class="q-ml-sm" />
          </div>
        </q-card>
      </div>

      <div v-else-if="compatibleSwaps.length === 0" class="text-grey text-caption q-mb-md q-pl-sm">
        <q-icon name="search_off" size="xs" /> Nessuna proposta compatibile al momento.
      </div>

      <div v-else class="q-gutter-xs q-mb-md">
        <q-card v-for="swap in compatibleSwaps" :key="swap.id" flat class="swap-card bg-blue-1 rounded-borders">
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center justify-between no-wrap">
              <div class="col">
                <div class="text-caption text-grey-7 q-mb-xs">
                  <q-icon name="event" size="xs" class="q-mr-xs" />
                  Cede il {{ formatDate(swap.date) }}
                </div>
                <div class="row items-center q-gutter-xs">
                  <span class="text-caption">Cede</span>
                  <q-chip :color="getShiftColor(swap.offeredShift)" text-color="white" size="sm" dense>
                    {{ swap.offeredShift }}
                  </q-chip>
                  <span class="text-caption">per tuo</span>
                  <q-chip :color="getShiftColor(swap.desiredShift)" text-color="white" size="sm" dense>
                    {{ swap.desiredShift }}
                  </q-chip>
                  <span class="text-caption text-grey-6">({{ formatDate(swap.desiredDate) }})</span>
                </div>
              </div>
              <div class="row items-center q-gutter-x-xs no-wrap">
                <q-btn flat round size="sm" color="grey-6" icon="visibility_off" @click.stop="toggleInterest(swap.id, false)">
                  <q-tooltip>Non mi interessa</q-tooltip>
                </q-btn>
                <q-btn unelevated color="primary" icon="handshake" label="Accetta" size="sm" 
                  :loading="accepting[swap.id]" @click="acceptSwap(swap)" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Ignored Swaps Section -->
      <q-expansion-item v-if="ignoredSwaps.length > 0" icon="visibility_off" label="Cambi ignorati"
        header-class="text-grey-7 text-caption" dense class="q-mt-md" @show="loadIgnored">
        <q-list separator dense>
          <q-item v-for="swap in ignoredSwaps" :key="swap.id" class="q-py-xs bg-grey-1">
            <q-item-section>
              <q-item-label class="text-caption">
                {{ formatDate(swap.date) }}: {{ swap.offeredShift }} ⇄ {{ swap.desiredShift }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn flat round size="xs" color="primary" icon="visibility" @click="toggleInterest(swap.id, true)">
                <q-tooltip>Ripristina</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>

      <q-separator class="q-my-sm" />

      <!-- ===== SEZIONE 3: Cambi che ho accettato ===== -->
      <template v-if="myAcceptedSwaps.length > 0">
        <div class="text-caption text-weight-bold text-grey-8 q-mb-sm q-mt-sm">
          <q-icon name="handshake" size="xs" class="q-mr-xs" />
          Cambi che ho accettato
        </div>
        <div class="q-gutter-xs">
          <q-card v-for="swap in myAcceptedSwaps" :key="swap.id + '-accepted'" flat
            class="my-swap-card rounded-borders">
            <q-card-section class="q-py-sm q-px-md">
              <div class="row items-center justify-between no-wrap">
                <div class="col">
                  <div class="text-caption text-grey-7 q-mb-xs">
                    <q-icon name="event" size="xs" class="q-mr-xs" />
                    {{ formatDate(swap.date) }}
                  </div>
                  <div class="row items-center q-gutter-xs">
                    <span class="text-caption">Ricevo</span>
                    <q-chip :color="getShiftColor(swap.offeredShift)" text-color="white" size="sm" dense>
                      {{ swap.offeredShift }}
                    </q-chip>
                    <span class="text-caption">, cedo</span>
                    <q-chip :color="getShiftColor(swap.desiredShift)" text-color="white" size="sm" dense>
                      {{ swap.desiredShift }}
                    </q-chip>
                  </div>
                  <div class="text-caption text-grey-7 q-mt-xs">
                    <q-icon name="person" size="xs" />
                    Da: <strong>{{ swap.creatorName || 'Collega' }}</strong>
                  </div>
                </div>
                <q-badge :color="getSwapStatusColor(swap.status)" :label="getSwapStatusLabel(swap.status)" />
              </div>
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.swap-card {
  border-left: 3px solid var(--q-primary);
  transition: box-shadow 0.2s ease;
}
.swap-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.my-swap-card {
  border-left: 3px solid #9c9c9c;
  background: #fafafa;
}
</style>
