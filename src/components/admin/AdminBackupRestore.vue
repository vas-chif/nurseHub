<template>
  <div class="q-pa-md">
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-h6">Gestione Backup & Ripristino</div>
        <div class="text-caption text-grey">Protezione dati e continuità operativa (GDPR Art. 30)</div>
      </div>
      <div class="row q-gutter-sm">
        <q-btn flat round icon="refresh" @click="loadBackups" :loading="loading">
          <q-tooltip>Aggiorna lista</q-tooltip>
        </q-btn>
        <q-btn color="primary" icon="cloud_upload" label="Backup Manuale" @click="confirmManualBackup" />
      </div>
    </div>

    <!-- Stats / Auto-Backup Toggle -->
    <q-card flat bordered class="q-mb-lg bg-blue-grey-1">
      <q-card-section class="row items-center justify-between">
        <div class="row items-center">
          <q-icon name="auto_mode" size="md" color="primary" class="q-mr-md" />
          <div>
            <div class="text-subtitle2">Automazione Backup Schedulato</div>
            <div class="text-caption">Eseguito ogni notte alle 02:00 (Europe/Rome)</div>
          </div>
        </div>
        <div v-if="loading" class="row items-center">
          <q-skeleton type="rect" width="80px" height="30px" class="q-ml-md" />
        </div>
        <q-toggle
          v-else
          v-model="autoBackupEnabled"
          label="Attivo"
          color="green"
          @update:model-value="toggleAutomation"
        />
      </q-card-section>
    </q-card>

    <!-- Backup List -->
    <q-table
      title="Backup Disponibili (GCS)"
      :rows="backups"
      :columns="columns"
      row-key="path"
      :loading="loading"
      flat
      bordered
      :pagination="{ rowsPerPage: 10 }"
    >
      <template v-slot:body-cell-status="props">
        <q-td :props="props">
          <q-badge :color="props.row.isToday ? 'green' : 'blue'" :label="props.row.isToday ? 'Recente' : 'Archivio'" />
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props" class="q-gutter-xs">
          <q-btn flat round dense icon="restore" color="orange" @click="confirmRestore(props.row)">
            <q-tooltip>Ripristina da questo backup</q-tooltip>
          </q-btn>
          <q-btn flat round dense icon="delete" color="negative" @click="confirmDelete(props.row)">
            <q-tooltip>Elimina definitivamente</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Recent Logs Section -->
    <div class="text-subtitle1 q-mt-xl q-mb-md text-weight-bold">Ultimi Log Operativi</div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card flat bordered style="height: 300px; overflow-y: auto;">
          <q-card-section class="bg-grey-2 q-py-xs text-weight-bold">Ultimi Backup</q-card-section>
          <q-list separator>
            <template v-if="loading && backupLogs.length === 0">
              <q-item v-for="n in 5" :key="`sk-b-${n}`">
                <q-item-section avatar>
                  <q-skeleton type="QAvatar" size="24px" />
                </q-item-section>
                <q-item-section>
                  <q-skeleton type="text" width="70%" />
                  <q-skeleton type="text" width="40%" />
                </q-item-section>
              </q-item>
            </template>
            <template v-else>
              <q-item v-for="log in backupLogs" :key="log.id">
                <q-item-section avatar>
                  <q-icon :name="log.status === 'SUCCESS' ? 'check_circle' : 'error'" :color="log.status === 'SUCCESS' ? 'green' : 'red'" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ log.triggerType }} - {{ log.status }}</q-item-label>
                  <q-item-label caption>{{ formatFullDate(log.timestamp) }}</q-item-label>
                </q-item-section>
                <q-item-section side v-if="log.executionTime">
                  <q-badge color="grey-7" :label="`${(log.executionTime / 1000).toFixed(1)}s`" />
                </q-item-section>
              </q-item>
              <q-item v-if="backupLogs.length === 0">
                <q-item-section class="text-grey italic text-center">Nessun log trovato</q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card flat bordered style="height: 300px; overflow-y: auto;">
          <q-card-section class="bg-grey-2 q-py-xs text-weight-bold">Ultimi Ripristini</q-card-section>
          <q-list separator>
            <template v-if="loading && restoreLogs.length === 0">
              <q-item v-for="n in 3" :key="`sk-r-${n}`">
                <q-item-section avatar>
                  <q-skeleton type="QAvatar" size="24px" />
                </q-item-section>
                <q-item-section>
                  <q-skeleton type="text" width="60%" />
                  <q-skeleton type="text" width="30%" />
                </q-item-section>
              </q-item>
            </template>
            <template v-else>
              <q-item v-for="log in restoreLogs" :key="log.id">
                <q-item-section avatar>
                  <q-icon name="settings_backup_restore" color="orange" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ log.type === 'full' ? 'Full Restore' : 'Restore Parziale' }}</q-item-label>
                  <q-item-label caption>{{ formatFullDate(log.timestamp) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge :color="log.status === 'SUCCESS' ? 'green' : 'red'" :label="log.status" />
                </q-item-section>
              </q-item>
              <q-item v-if="restoreLogs.length === 0">
                <q-item-section class="text-grey italic text-center">Nessun log trovato</q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date as dateUtil } from 'quasar';
import { backupService } from '../../services/BackupService';
import { useAuthStore } from '../../stores/authStore';
import { useSecureLogger } from '../../utils/secureLogger';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../../boot/firebase';
import type { BackupMetadata, BackupLog, RestoreLog } from '../../types/backup';

const $q = useQuasar();
const authStore = useAuthStore();
const logger = useSecureLogger();

const loading = ref(false);
const backups = ref<BackupMetadata[]>([]);
const autoBackupEnabled = ref(false);
const backupLogs = ref<BackupLog[]>([]);
const restoreLogs = ref<RestoreLog[]>([]);

const columns = [
  { name: 'date', label: 'Data Backup', field: 'date', align: 'left' as const, sortable: true },
  { name: 'status', label: 'Stato', field: 'isToday', align: 'center' as const },
  { name: 'sizeGB', label: 'Dimensione (GB)', field: 'sizeGB', align: 'right' as const },
  { name: 'filesCount', label: 'File', field: 'filesCount', align: 'right' as const },
  { name: 'actions', label: 'Azioni', field: 'actions', align: 'center' as const }
];

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    await Promise.all([
      loadBackups(),
      loadAutoBackupStatus(),
      loadLogs()
    ]);
  } finally {
    loading.value = false;
  }
}

async function loadBackups() {
  try {
    backups.value = await backupService.listBackups();
  } catch {
    $q.notify({ type: 'negative', message: 'Errore caricamento lista backup' });
  }
}

async function loadAutoBackupStatus() {
  const docRef = doc(db, 'systemSettings', 'backup');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    autoBackupEnabled.value = snap.data().autoBackupEnabled;
  }
}

async function loadLogs() {
  try {
    const bSnap = await getDocs(query(collection(db, 'backupLogs'), orderBy('timestamp', 'desc'), limit(10)));
    const mSnap = await getDocs(query(collection(db, 'manualBackupLogs'), orderBy('timestamp', 'desc'), limit(10)));
    const rSnap = await getDocs(query(collection(db, 'restoreLogs'), orderBy('timestamp', 'desc'), limit(10)));

    const allBackupLogs = [
      ...bSnap.docs.map(d => ({ id: d.id, ...d.data() } as BackupLog)),
      ...mSnap.docs.map(d => ({ id: d.id, ...d.data() } as BackupLog))
    ].sort((a, b) => getTs(b.timestamp) - getTs(a.timestamp)).slice(0, 10);

    backupLogs.value = allBackupLogs;
    restoreLogs.value = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as RestoreLog));
  } catch (e) {
    logger.error('Error loading logs', e);
  }
}

function getTs(ts: Timestamp | number | Date | null | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts && typeof ts === 'object' && 'toMillis' in ts) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function formatFullDate(ts: Timestamp | number | Date | null | undefined) {
  return dateUtil.formatDate(getTs(ts), 'DD/MM/YYYY HH:mm');
}

function toggleAutomation(val: boolean) {
  $q.dialog({
    title: val ? 'Attiva Automazione' : 'Disattiva Automazione',
    message: 'Inserisci il motivo della modifica (obbligatorio):',
    prompt: {
      model: '',
      type: 'text',
      isValid: val => val.length > 5
    },
    cancel: true,
    persistent: true
  }).onOk((reason: string) => {
    void (async () => {
      try {
        await backupService.toggleAutoBackup(
          val, 
          reason, 
          authStore.currentUser!.uid, 
          authStore.currentUser!.email
        );
        $q.notify({ type: 'positive', message: `Automazione ${val ? 'attivata' : 'disattivata'}` });
      } catch {
        autoBackupEnabled.value = !val; // Revert
        $q.notify({ type: 'negative', message: 'Errore salvataggio' });
      }
    })();
  }).onCancel(() => {
    autoBackupEnabled.value = !val; // Revert
  });
}

function confirmManualBackup() {
  $q.dialog({
    title: 'Backup Manuale',
    message: 'Stai per avviare un backup completo di Firestore. Inserisci il motivo:',
    prompt: {
      model: 'Manutenzione programmata',
      type: 'text',
      isValid: val => val.length > 5
    },
    cancel: true,
    persistent: true
  }).onOk((reason: string) => {
    void (async () => {
      $q.loading.show({ message: 'Avvio backup in corso... Potrebbero volerci alcuni minuti.' });
      try {
        await backupService.triggerManualBackup(
          authStore.currentUser!.uid, 
          authStore.currentUser!.email,
          reason
        );
        $q.notify({ type: 'positive', message: 'Richiesta di backup inviata con successo.' });
        setTimeout(() => { void loadData(); }, 5000); // Reload after a bit
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
        $q.notify({ type: 'negative', message: msg });
      } finally {
        $q.loading.hide();
      }
    })();
  });
}

function confirmDelete(backup: BackupMetadata) {
  $q.dialog({
    title: 'Cancellazione Definitiva',
    message: `Sei sicuro di voler eliminare il backup del ${backup.date}? L'operazione è IRREVERSIBILE.`,
    prompt: {
      model: '',
      type: 'text',
      placeholder: 'Motivo della cancellazione',
      isValid: val => val.length > 5
    },
    cancel: { color: 'primary', flat: true },
    ok: { color: 'negative', label: 'Elimina Ora' },
    persistent: true
  }).onOk((reason: string) => {
    void (async () => {
      $q.loading.show({ message: 'Cancellazione in corso...' });
      try {
        await backupService.deleteBackup(
          backup.path, 
          '', // We don't have logId from the listing
          reason,
          authStore.currentUser!.uid,
          authStore.currentUser!.email
        );
        $q.notify({ type: 'positive', message: 'Backup eliminato correttamente.' });
        void loadBackups();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
        $q.notify({ type: 'negative', message: msg });
      } finally {
        $q.loading.hide();
      }
    })();
  });
}

function confirmRestore(backup: BackupMetadata) {
  $q.dialog({
    title: '⚠️ RIPRISTINO CRITICO',
    message: `ATTENZIONE: Stai per ripristinare il database allo stato del ${backup.date}. I dati correnti verranno sovrascritti. Confermi?`,
    prompt: {
      model: '',
      type: 'text',
      placeholder: 'Motivo del ripristino (es: Errore sincronizzazione)',
      isValid: val => val.length > 5
    },
    cancel: true,
    persistent: true
  }).onOk((reason: string) => {
    void (async () => {
      $q.loading.show({ 
        message: 'RIPRISTINO IN CORSO... NON CHIUDERE LA PAGINA.<br>Verrà creato un backup di emergenza prima del ripristino.',
        html: true
      });
      try {
        await backupService.restoreBackup(
          backup.path, 
          'full', 
          null, 
          reason,
          authStore.currentUser!.uid,
          authStore.currentUser!.email
        );
        $q.notify({ 
          type: 'positive', 
          message: 'Ripristino completato!', 
          timeout: 10000,
          actions: [{ label: 'OK', color: 'white' }]
        });
        void loadData();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
        $q.notify({ type: 'negative', message: msg, timeout: 0, actions: [{ label: 'Chiudi', color: 'white' }] });
      } finally {
        $q.loading.hide();
      }
    })();
  });
}
</script>

<style scoped>
.italic { font-style: italic; }
</style>
