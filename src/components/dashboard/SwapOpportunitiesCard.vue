<template>
  <q-card flat bordered class="q-mt-md">
    <!-- ===== Header ===== -->
    <q-card-section class="q-pb-none">
      <div class="row items-center justify-between">
        <div>
          <div class="text-subtitle1 text-weight-bold">
            <q-icon name="swap_horiz" color="primary" class="q-mr-xs" />
            Cambi Turno
          </div>
          <div class="text-caption text-grey">Opportunità disponibili e le tue proposte</div>
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

      <div v-if="loading" class="text-center q-py-sm">
        <q-spinner color="primary" size="1.2em" />
      </div>

      <div v-else-if="compatibleSwaps.length === 0" class="text-grey text-caption q-mb-md q-pl-sm">
        <q-icon name="search_off" size="xs" /> Nessuna proposta compatibile con il tuo turno.
      </div>

      <div v-else class="q-gutter-xs q-mb-md">
        <q-card
          v-for="swap in compatibleSwaps"
          :key="swap.id"
          flat
          class="swap-card bg-blue-1 rounded-borders"
        >
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center justify-between no-wrap">
              <div class="col">
                <div class="text-caption text-grey-7 q-mb-xs">
                  <q-icon name="event" size="xs" class="q-mr-xs" />
                  {{ formatDate(swap.date) }}
                </div>
                <div class="row items-center q-gutter-xs">
                  <span class="text-caption">Un collega cede</span>
                  <q-chip
                    :color="getShiftColor(swap.offeredShift)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ swap.offeredShift }}
                  </q-chip>
                  <span class="text-caption">in cambio del tuo</span>
                  <q-chip
                    :color="getShiftColor(swap.desiredShift)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ swap.desiredShift }}
                  </q-chip>
                </div>
                <div class="text-caption text-grey-6 q-mt-xs">
                  <q-icon name="lock" size="xs" /> Nome rivelato dopo accettazione
                </div>
              </div>
              <q-btn
                unelevated
                color="primary"
                icon="handshake"
                label="Accetta"
                size="sm"
                class="q-ml-sm"
                :loading="accepting[swap.id]"
                @click="acceptSwap(swap)"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <q-separator class="q-my-sm" />

      <!-- ===== SEZIONE 2: Le mie proposte ===== -->
      <div class="text-caption text-weight-bold text-grey-8 q-mb-sm q-mt-sm">
        <q-icon name="edit_note" size="xs" class="q-mr-xs" />
        Le mie proposte
      </div>

      <div v-if="mySwaps.length === 0" class="text-grey text-caption q-pl-sm">
        <q-icon name="inbox" size="xs" /> Nessuna proposta inviata.
      </div>

      <div v-else class="q-gutter-xs">
        <q-card v-for="swap in mySwaps" :key="swap.id" flat class="my-swap-card rounded-borders">
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center justify-between no-wrap">
              <div class="col">
                <div class="text-caption text-grey-7 q-mb-xs">
                  <q-icon name="event" size="xs" class="q-mr-xs" />
                  {{ formatDate(swap.date) }}
                </div>
                <div class="row items-center q-gutter-xs">
                  <span class="text-caption">Cedo</span>
                  <q-chip
                    :color="getShiftColor(swap.offeredShift)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ swap.offeredShift }}
                  </q-chip>
                  <span class="text-caption">per</span>
                  <q-chip
                    :color="getShiftColor(swap.desiredShift)"
                    text-color="white"
                    size="sm"
                    dense
                  >
                    {{ swap.desiredShift }}
                  </q-chip>
                </div>
                <!-- Status text -->
                <div class="text-caption q-mt-xs">
                  <span v-if="swap.status === 'OPEN'" class="text-primary">
                    In attesa di un collega...
                  </span>
                  <span
                    v-else-if="swap.status === 'MATCHED' || swap.status === 'PENDING_ADMIN'"
                    class="text-warning"
                  >
                    <q-icon name="handshake" size="xs" />
                    Accordo con <strong>{{ swap.counterpartName || 'un collega' }}</strong> — attesa
                    admin
                  </span>
                  <span v-else-if="swap.status === 'APPROVED'" class="text-positive">
                    <q-icon name="check_circle" size="xs" /> Approvato!
                  </span>
                  <span v-else-if="swap.status === 'REJECTED'" class="text-negative">
                    <q-icon name="cancel" size="xs" /> Rifiutato
                    <span v-if="swap.adminNote">: {{ swap.adminNote }}</span>
                  </span>
                </div>
              </div>

              <!-- Right: badge + cancel -->
              <div class="column items-end q-gutter-xs q-ml-sm">
                <q-badge
                  :color="getSwapStatusColor(swap.status)"
                  :label="getSwapStatusLabel(swap.status)"
                />
                <q-btn
                  v-if="swap.status === 'OPEN'"
                  flat
                  dense
                  round
                  icon="delete"
                  color="negative"
                  size="sm"
                  @click="cancelSwap(swap)"
                >
                  <q-tooltip>Cancella proposta</q-tooltip>
                </q-btn>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import type { ShiftSwap, ShiftSwapStatus } from '../../types/models';

const $q = useQuasar();
const authStore = useAuthStore();

const loading = ref(false);
const accepting = ref<Record<string, boolean>>({});
const compatibleSwaps = ref<ShiftSwap[]>([]);
const mySwaps = ref<ShiftSwap[]>([]);

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

async function loadAll() {
  loading.value = true;
  try {
    await Promise.all([loadOpportunities(), loadMySwaps()]);
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
    .map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap)
    .filter((s) => s.creatorId !== uid);

  compatibleSwaps.value = allOpen.filter((swap) => {
    if (!operatorSchedule) return false;
    return operatorSchedule[swap.date] === swap.desiredShift;
  });
}

async function loadMySwaps() {
  const uid = authStore.currentUser?.uid;
  if (!uid) return;
  const snap = await getDocs(
    query(
      collection(db, 'shiftSwaps'),
      where('creatorId', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  mySwaps.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap);
}

function acceptSwap(swap: ShiftSwap) {
  const uid = authStore.currentUser?.uid;
  const operatorId = authStore.currentOperator?.id;
  if (!uid || !operatorId) {
    $q.notify({ type: 'warning', message: 'Profilo operatore non collegato' });
    return;
  }

  $q.dialog({
    title: 'Accetta Proposta di Cambio',
    message: `Confermi di accettare il cambio del ${formatDate(swap.date)}?\nCederai il turno ${swap.desiredShift} e riceverai il turno ${swap.offeredShift}.\nLa proposta andrà in approvazione all'admin.`,
    cancel: true,
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

        $q.notify({
          type: 'positive',
          message: 'Proposta accettata! In attesa di approvazione admin.',
          icon: 'handshake',
        });
        compatibleSwaps.value = compatibleSwaps.value.filter((s) => s.id !== swap.id);
        // Reload my swaps to show it as PENDING_ADMIN
        await loadMySwaps();
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: "Errore durante l'accettazione" });
      } finally {
        accepting.value[swap.id] = false;
      }
    })();
  });
}

function cancelSwap(swap: ShiftSwap) {
  $q.dialog({
    title: 'Cancella Proposta',
    message: `Sei sicuro di voler cancellare la proposta del ${formatDate(swap.date)}? (${swap.offeredShift} → ${swap.desiredShift})`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await deleteDoc(doc(db, 'shiftSwaps', swap.id));
        mySwaps.value = mySwaps.value.filter((s) => s.id !== swap.id);
        $q.notify({ type: 'info', message: 'Proposta cancellata', icon: 'delete' });
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: 'Errore durante la cancellazione' });
      }
    })();
  });
}
</script>

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
  transition: box-shadow 0.2s ease;
}
.my-swap-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
</style>
