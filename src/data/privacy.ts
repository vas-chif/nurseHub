/**
 * @file privacy.ts
 * @description Privacy policy content
 */

import { ref } from 'vue';
import type { ITabSelezionati } from '../types/legal';

export const informativa = ref([
  { title: 'Informativa sul trattamento dei dati personali' },
  { subtitle: 'Ai sensi degli artt. 13 e 14 del Regolamento 2016/679/UE (GDPR)' },
  {
    paragrafo:
      "Nurse Hub è un'applicazione per la gestione dei turni e dei dati personali degli infermieri. I dati raccolti sono trattati esclusivamente per finalità di gestione operativa, nel pieno rispetto della riservatezza e dei diritti degli interessati.",
  },
]);

export const btnTab = ref<ITabSelezionati[]>([
  {
    name: 'go-to-home',
    icon: 'undo',
    label: 'Torna alla Home',
    clickable: true,
  },
]);

export const tabsMenuPrivacyTratamento = ref<ITabSelezionati[]>([
  {
    name: 'tratamento',
    label: 'TRATTAMENTO',
    title: 'TRATTAMENTO',
    clickable: false,
  },
  {
    name: 'titolare',
    icon: 'person',
    label: 'Titolare',
    clickable: true,
    dettagli: [
      {
        icon: 'person',
        titolo: 'Titolare del trattamento',
        nome: 'Nurse Hub',
        valore: 'Nurse Hub Team',
      },
      { nome: 'Email', valore: 'support@nursehub.com' },
    ],
  },
  {
    name: 'dati',
    icon: 'card_membership',
    label: 'Dati trattati',
    clickable: true,
    dettagli: [
      {
        icon: 'data_saver_on',
        titolo: 'Dati trattati',
        nome: 'Dati comuni trattati',
        valore: 'Nome, cognome, indirizzo email, ruolo professionale, dati sui turni lavorativi.',
      },
    ],
  },
]);

export const tabsMenuPrivacyRuoli = ref<ITabSelezionati[]>([
  {
    name: 'ruoli',
    label: 'RUOLI',
    title: 'RUOLI',
    clickable: false,
  },
  {
    name: 'responsabili',
    icon: 'supervisor_account',
    label: 'Responsabili',
    clickable: true,
    dettagli: [
      {
        icon: 'supervisor_account',
        titolo: 'Responsabile del trattamento',
        nome: '',
        valore: "L'elenco aggiornato dei Responsabili del trattamento è disponibile su richiesta.",
      },
    ],
  },
]);

export const tabsMenuPrivacyNote = ref<ITabSelezionati[]>([
  { name: 'note', label: 'NOTE', title: 'NOTE', clickable: false },
  {
    name: 'diritti-interessati',
    icon: 'gavel',
    label: 'Diritti degli interessati',
    clickable: true,
    dettagli: [
      {
        icon: 'gavel',
        titolo: 'Diritti degli interessati',
        nome: 'Diritto di accesso',
        valore:
          "L'interessato ha diritto di richiedere l'accesso ai propri dati, la rettifica o la cancellazione.",
      },
    ],
  },
]);
