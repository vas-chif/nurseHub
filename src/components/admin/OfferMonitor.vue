<template>
  <q-card flat bordered class="q-mt-md">
    <q-card-section>
      <div class="text-h6">Monitoraggio Offerte</div>
    </q-card-section>

    <q-list separator>
      <div v-if="offers.length === 0" class="q-pa-md text-grey text-center">
        Nessuna offerta recente.
      </div>

      <q-item v-for="offer in offers" :key="offer.id">
        <q-item-section avatar>
          <q-avatar icon="person" color="grey-2" text-color="primary" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="text-weight-bold">{{ offer.operatorName }}</q-item-label>
          <q-item-label caption>
            Offerta per: {{ offer.date }} - <q-badge :label="offer.shift" color="primary" />
          </q-item-label>
          <q-item-label caption class="text-orange" v-if="offer.scenarioLabel">
            Scenario: {{ offer.scenarioLabel }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <div class="row q-gutter-xs">
            <q-btn
              round
              flat
              color="negative"
              icon="close"
              size="sm"
              @click="rejectOffer(offer.id)"
            />
            <q-btn
              round
              flat
              color="positive"
              icon="check"
              size="sm"
              @click="acceptOffer(offer.id)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// Mock data extending ShiftOffer slightly for UI
const offers = ref([
  {
    id: 'off-1',
    operatorName: 'Mario Rossi',
    date: '12/02/2026',
    shift: 'M',
    scenarioLabel: 'Spostamento Riposo',
  },
  {
    id: 'off-2',
    operatorName: 'Luigi Verdi',
    date: '13/02/2026',
    shift: 'N',
    scenarioLabel: 'Doppio Turno',
  },
]);

function acceptOffer(id: string) {
  console.log('Accepting', id);
  offers.value = offers.value.filter((o) => o.id !== id);
}

function rejectOffer(id: string) {
  console.log('Rejecting', id);
  offers.value = offers.value.filter((o) => o.id !== id);
}
</script>
