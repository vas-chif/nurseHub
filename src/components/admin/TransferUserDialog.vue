<script setup lang="ts">
/**
 * @file TransferUserDialog.vue
 * @description Dialog per il trasferimento di un utente verso un'altra configurazione (reparto).
 *   Carica i reparti disponibili e gli operatori liberi del reparto selezionato.
 *   SuperAdmin only — consumato da AdminUsersPage.vue (Fase 6).
 * @author Nurse Hub Team
 * @created 2026-05-13
 */
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import type { User, SystemConfiguration, Operator } from '../../types/models';
import { useConfigStore } from '../../stores/configStore';
import { operatorsService } from '../../services/OperatorsService';
import { userService } from '../../services/UserService';
import { useSecureLogger } from '../../utils/secureLogger';

interface Props {
  modelValue: boolean;
  user: User | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  transferred: [];
}>();

const $q = useQuasar();
const configStore = useConfigStore();
const logger = useSecureLogger();

const selectedConfigId = ref<string | null>(null);
const operators = ref<Operator[]>([]);
const selectedOperatorId = ref<string | null>(null);
const loadingOperators = ref(false);
const saving = ref(false);

/** Tutti i reparti disponibili tranne quello corrente dell'utente */
const availableConfigs = computed<SystemConfiguration[]>(() =>
  configStore.allConfigs.filter((c) => c.id !== props.user?.configId),
);

/** Operatori senza associazione utente (liberi) o già associati a questo utente */
const freeOperators = computed<Operator[]>(() =>
  operators.value.filter((op) => !op.userId || op.userId === props.user?.uid),
);

const selectedConfig = computed<SystemConfiguration | null>(
  () => availableConfigs.value.find((c) => c.id === selectedConfigId.value) ?? null,
);

const selectedOperator = computed<Operator | null>(
  () => freeOperators.value.find((op) => op.id === selectedOperatorId.value) ?? null,
);

const canConfirm = computed<boolean>(
  () => !!selectedConfigId.value && !!selectedOperatorId.value && !loadingOperators.value && !saving.value,
);

/** Reset dello stato ad ogni apertura del dialog */
watch(
  () => [props.modelValue, props.user?.uid] as const,
  ([isOpen]) => {
    if (isOpen) {
      selectedConfigId.value = null;
      selectedOperatorId.value = null;
      operators.value = [];
    }
  },
);

/** Carica operatori quando cambia il reparto selezionato */
watch(selectedConfigId, async (configId) => {
  selectedOperatorId.value = null;
  operators.value = [];
  if (!configId) return;

  loadingOperators.value = true;
  try {
    operators.value = await operatorsService.getOperatorsByConfig(configId);
  } catch (error) {
    logger.error('TransferUserDialog: errore caricamento operatori', { configId, error });
    $q.notify({ type: 'negative', message: 'Errore nel caricamento degli operatori del reparto.' });
  } finally {
    loadingOperators.value = false;
  }
});

async function onConfirm() {
  if (!props.user || !selectedConfigId.value || !selectedOperator.value) return;
  saving.value = true;
  try {
    await userService.transferUserToConfig(
      props.user.uid,
      selectedConfigId.value,
      selectedOperator.value.id,
      selectedConfig.value?.profession ?? props.user.profession ?? '',
    );
    emit('update:modelValue', false);
    emit('transferred');
    $q.notify({
      type: 'positive',
      message: `${props.user.firstName} trasferito/a in "${selectedConfig.value?.name ?? selectedConfigId.value}"`,
    });
  } catch (error) {
    logger.error('TransferUserDialog: errore trasferimento', {
      uid: props.user.uid,
      targetConfigId: selectedConfigId.value,
      error,
    });
    $q.notify({ type: 'negative', message: 'Errore durante il trasferimento. Riprovare.' });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <q-dialog :model-value="modelValue" persistent @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 420px; max-width: 560px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Trasferisci Reparto</div>
        <q-space />
        <q-btn icon="close" flat round dense :disable="saving" v-close-popup />
      </q-card-section>

      <q-card-section v-if="user">
        <!-- Riepilogo utente -->
        <div class="text-subtitle2 q-mb-sm text-grey-7">Utente selezionato</div>
        <q-item dense class="q-px-none q-mb-md">
          <q-item-section avatar>
            <q-avatar color="primary" text-color="white" size="36px">
              {{ user?.firstName?.charAt(0)?.toUpperCase() ?? '' }}{{ user?.lastName?.charAt(0)?.toUpperCase() ?? '' }}
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ user?.firstName }} {{ user?.lastName }}</q-item-label>
            <q-item-label caption>{{ user?.email }}</q-item-label>
          </q-item-section>
        </q-item>

        <!-- Reparto corrente (Da) -->
        <div class="text-subtitle2 q-mb-xs text-grey-7">Reparto attuale</div>
        <q-chip square color="orange-2" text-color="orange-9" class="q-mb-md">
          <q-icon name="apartment" class="q-mr-xs" />
          {{
            configStore.allConfigs.find((c) => c.id === user?.configId)?.name ??
            user?.configId ??
            'Nessun reparto'
          }}
        </q-chip>

        <q-icon name="arrow_downward" color="grey-5" size="20px" class="q-mb-md block" />

        <!-- Selezione reparto destinazione (A) -->
        <div class="text-subtitle2 q-mb-xs text-grey-7">Reparto destinazione</div>
        <q-select
          v-model="selectedConfigId"
          :options="availableConfigs"
          option-value="id"
          option-label="name"
          emit-value
          map-options
          outlined
          dense
          label="Seleziona reparto"
          class="q-mb-md"
          :disable="saving"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.name }}</q-item-label>
                <q-item-label caption>{{ scope.opt.profession }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <!-- Selezione operatore (con skeleton durante il caricamento) -->
        <template v-if="selectedConfigId">
          <div class="text-subtitle2 q-mb-xs text-grey-7">
            Operatore da associare
            <q-badge v-if="!loadingOperators" color="grey-4" text-color="grey-8" class="q-ml-xs">
              {{ freeOperators.length }} liberi
            </q-badge>
          </div>

          <!-- Skeleton durante il caricamento operatori §1.10 -->
          <div v-if="loadingOperators">
            <q-item v-for="n in 3" :key="n" dense>
              <q-item-section avatar>
                <q-skeleton type="QAvatar" size="28px" />
              </q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="50%" />
                <q-skeleton type="text" width="30%" />
              </q-item-section>
            </q-item>
          </div>

          <q-select
            v-else
            v-model="selectedOperatorId"
            :options="freeOperators"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            outlined
            dense
            label="Seleziona operatore libero"
            :disable="saving"
            :no-options-label="'Nessun operatore libero in questo reparto'"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar>
                  <q-avatar color="teal-2" text-color="teal-9" size="28px" font-size="12px">
                    {{ scope.opt.name?.charAt(0) ?? '?' }}
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.name }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </template>
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat label="Annulla" color="grey" :disable="saving" v-close-popup />
        <q-btn
          label="Trasferisci"
          color="primary"
          unelevated
          :disable="!canConfirm"
          :loading="saving"
          @click="onConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* dialog occupies a clean card width; no overrides needed */
</style>
