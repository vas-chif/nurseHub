<template>
  <q-card flat bordered class="q-mt-md">
    <q-card-section class="q-pb-none">
      <div class="row items-center justify-between">
        <div>
          <div class="text-subtitle1 text-weight-bold">
            <q-icon name="swap_horiz" color="primary" class="q-mr-xs" />
            Proposte Cambio Turno
          </div>
          <div class="text-caption text-grey">
            Colleghi che cercano uno scambio compatibile con il tuo turno
          </div>
        </div>
        <q-btn
          flat
          round
          dense
          icon="refresh"
          size="sm"
          :loading="loading"
          @click="loadOpportunities"
        >
          <q-tooltip>Aggiorna proposte</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-card-section>
      <!-- Loading state -->
      <div v-if="loading" class="text-center q-py-md">
        <q-spinner color="primary" size="1.5em" />
        <div class="text-caption text-grey q-mt-xs">Ricerca proposte compatibili...</div>
      </div>

      <!-- Empty state -->
      <div v-else-if="compatibleSwaps.length === 0" class="text-center text-grey q-py-md">
        <q-icon name="search_off" size="1.5em" />
        <div class="text-caption q-mt-xs">
          Nessuna proposta compatibile con il tuo turno al momento.
        </div>
      </div>

      <!-- Swap opportunities list -->
      <div v-else class="q-gutter-sm">
        <q-card
          v-for="swap in compatibleSwaps"
          :key="swap.id"
          flat
          class="swap-card bg-blue-1 rounded-borders"
        >
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center justify-between no-wrap">
              <div class="col">
                <!-- Date -->
                <div class="text-caption text-grey-7 q-mb-xs">
                  <q-icon name="event" size="xs" class="q-mr-xs" />
                  {{ formatDate(swap.date) }}
                </div>

                <!-- Anonymous shift swap info -->
                <div class="row items-center q-gutter-xs">
                  <span class="text-caption">Un collega cede</span>
                  <q-chip
                    :color="getShiftColor(swap.offeredShift)"
                    text-color="white"
                    size="sm"
                    dense
                    >{{ swap.offeredShift }}</q-chip
                  >
                  <span class="text-caption">in cambio del tuo</span>
                  <q-chip
                    :color="getShiftColor(swap.desiredShift)"
                    text-color="white"
                    size="sm"
                    dense
                    >{{ swap.desiredShift }}</q-chip
                  >
                </div>
                <div class="text-caption text-grey-6 q-mt-xs">
                  <q-icon name="lock" size="xs" /> Il nome del collega sarà rivelato dopo
                  l'accettazione
                </div>
              </div>

              <!-- Accept button -->
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
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date as qDate } from 'quasar';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useConfigStore } from '../../stores/configStore';
import type { ShiftSwap } from '../../types/models';

const $q = useQuasar();
const authStore = useAuthStore();

const loading = ref(false);
const accepting = ref<Record<string, boolean>>({});
const compatibleSwaps = ref<ShiftSwap[]>([]);

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
  return qDate.formatDate(dt, 'DD/MM/YYYY (dddd)');
}

onMounted(() => {
  void loadOpportunities();
});

async function loadOpportunities() {
  const uid = authStore.currentUser?.uid;
  const operatorSchedule = authStore.currentOperator?.schedule;
  if (!uid) return;

  loading.value = true;
  try {
    // Fetch all OPEN swaps not created by current user
    const q = query(collection(db, 'shiftSwaps'), where('status', '==', 'OPEN'));
    const snap = await getDocs(q);
    const allOpen = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as ShiftSwap)
      .filter((s) => s.creatorId !== uid);

    // Filter only compatible: I must have `desiredShift` on that date
    compatibleSwaps.value = allOpen.filter((swap) => {
      if (!operatorSchedule) return false;
      const myShiftOnDate = operatorSchedule[swap.date];
      return myShiftOnDate === swap.desiredShift;
    });
  } catch (e) {
    console.error('Error loading swap opportunities', e);
  } finally {
    loading.value = false;
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
    title: 'Accetta Proposta di Cambio',
    message: `Confermi di accettare il cambio del ${formatDate(swap.date)}?\n
Cederai il turno ${swap.desiredShift} e riceverai il turno ${swap.offeredShift}.\n
La proposta andrà in approvazione all'admin.`,
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

        // Remove from the local list
        compatibleSwaps.value = compatibleSwaps.value.filter((s) => s.id !== swap.id);
      } catch (e) {
        console.error(e);
        $q.notify({ type: 'negative', message: "Errore durante l'accettazione" });
      } finally {
        accepting.value[swap.id] = false;
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
</style>
