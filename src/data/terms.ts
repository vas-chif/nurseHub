/**
 * @file terms.ts
 * @description Terms and Conditions content
 */

import { ref } from 'vue';
import type { ITabSelezionati } from '../types/legal';

export const termsIntro = ref([
  { title: "Termini e Condizioni d'Uso di Nurse Hub" },
  { subtitle: 'Ultimo aggiornamento: Febbraio 2026' },
  {
    paragrafo:
      "I presenti Termini e Condizioni regolano l'accesso e l'utilizzo dell'applicazione Nurse Hub. Utilizzando l'App, l'utente accetta integralmente i presenti Termini.",
  },
]);

export const btnTabTerms = ref<ITabSelezionati[]>([
  {
    name: 'go-to-home',
    icon: 'undo',
    label: 'Torna alla Home',
    clickable: true,
  },
]);

export const tabsMenuTermsGeneral = ref<ITabSelezionati[]>([
  {
    name: 'general',
    label: 'TERMINI GENERALI',
    title: 'TERMINI GENERALI',
    clickable: false,
  },
  {
    name: 'agreement',
    icon: 'gavel',
    label: 'Accettazione Termini',
    clickable: true,
    dettagli: [
      {
        icon: 'gavel',
        titolo: 'Accordo sui Termini',
        nome: 'Consenso',
        valore:
          "Accedendo a Nurse Hub, l'utente accetta di essere vincolato da questi Termini e Condizioni.",
      },
    ],
  },
]);

export const tabsMenuTermsUse = ref<ITabSelezionati[]>([
  {
    name: 'use',
    label: 'UTILIZZO',
    title: 'UTILIZZO',
    clickable: false,
  },
  {
    name: 'responsibilities',
    icon: 'verified_user',
    label: 'Responsabilità',
    clickable: true,
    dettagli: [
      {
        icon: 'verified_user',
        titolo: 'Responsabilità Utente',
        nome: 'Account',
        valore: "L'utente è responsabile della riservatezza delle proprie credenziali.",
      },
    ],
  },
]);
