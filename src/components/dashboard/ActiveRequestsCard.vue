<template>
  <q-card flat bordered class="bg-red-1 q-mt-md">
    <q-card-section>
      <div class="row items-center justify-between">
        <div class="text-h6 text-red-9">Richieste Urgenti</div>
        <q-badge
          v-if="requests.length > 0"
          color="red"
          text-color="white"
          :label="requests.length"
        />
      </div>
    </q-card-section>

    <div v-if="loading" class="row justify-center q-pa-md">
      <q-spinner color="red" size="2em" />
    </div>

    <div v-else-if="requests.length === 0" class="text-center text-grey q-pa-md text-caption">
      Nessuna richiesta urgente attiva.
    </div>

    <q-list separator v-else>
      <q-item v-for="req in requests" :key="req.id" class="bg-white">
        <q-item-section avatar>
          <q-avatar icon="warning" color="red-1" text-color="red" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-bold">
            {{ formatDate(req.date) }} - <q-badge color="red">{{ req.originalShift }}</q-badge>
          </q-item-label>
          <q-item-label caption lines="1">
            {{ req.reason === 'SHORTAGE' ? 'Carenza Personale' : 'Sostituzione' }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn
            flat
            round
            color="primary"
            :icon="authStore.isAdmin ? 'visibility' : 'arrow_forward'"
            :to="authStore.isAdmin ? '/admin/requests' : '/requests'"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import { useAuthStore } from '../../stores/authStore';
import type { ShiftRequest } from '../../types/models';

const authStore = useAuthStore();

const requests = ref<ShiftRequest[]>([]);
const loading = ref(true);

onMounted(async () => {
  if (!authStore.currentUser?.uid) return;
  try {
    // Fetch OPEN requests
    const q = query(
      collection(db, 'shiftRequests'),
      where('status', '==', 'OPEN'),
      orderBy('createdAt', 'desc'),
      limit(10),
    );

    const snapshot = await getDocs(q);
    const loaded: ShiftRequest[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data() as Omit<ShiftRequest, 'id'>;
      // Filter out own requests
      if (data.creatorId === authStore.currentUser?.uid) return;

      // Filter by candidateIds if present
      // If candidateIds is defined and not empty, current user MUST be in it to see the request.
      // We need currentOperator.id.
      // If currentOperator is not loaded yet, we might miss it.

      const myOpId = authStore.currentOperator?.id;
      if (data.candidateIds && data.candidateIds.length > 0) {
        if (!myOpId || !data.candidateIds.includes(myOpId)) return;
      }

      loaded.push({ id: doc.id, ...data });
    });

    requests.value = loaded;
  } catch (e) {
    console.error('Error fetching active requests', e);
  } finally {
    loading.value = false;
  }
});

function formatDate(dateStr: string) {
  // dateStr is YYYY-MM-DD
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
}
</script>
