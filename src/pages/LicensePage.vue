<template>
  <div class="pages" aria-label="License Page">
    <q-layout view="hHh lpR fFf" class="rounded-borders">
      <q-header elevated class="bg-primary text-white">
        <q-toolbar class="q-mt-lg">
          <q-btn flat @click="leftDrawerOpen = !leftDrawerOpen" round dense icon="menu" />
          <q-toolbar-title class="head-3 column">
            <div>Licenze Software</div>
            <div class="text-subtitle2">Nurse Hub</div>
          </q-toolbar-title>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page class="bg-grey-2 q-pa-md">
          <!-- Header expansion -->
          <q-expansion-item default-opened class="bg-white shadow-1 rounded-borders q-mb-md">
            <template v-slot:header>
              <q-item-section avatar>
                <q-avatar icon="assignment" color="primary" text-color="white" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-h6">Licenze Open Source</q-item-label>
                <q-item-label caption>Librerie e componenti utilizzati</q-item-label>
              </q-item-section>
            </template>

            <q-card>
              <q-card-section>
                <div class="text-body1">
                  Questo progetto utilizza le seguenti tecnologie open source.
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <!-- Content sections -->
          <div v-if="selectedDettaglio && selectedDettaglio.length > 0" class="q-py-sm">
            <q-list v-for="(detail, index) in selectedDettaglio" :key="index" class="q-mb-md">
              <q-card flat bordered class="bg-white">
                <q-card-section
                  v-if="detail.titolo"
                  class="bg-grey-1 text-primary text-weight-bold"
                >
                  <q-icon :name="detail.icon || 'info'" class="q-mr-sm" />
                  {{ detail.titolo }}
                </q-card-section>

                <q-separator v-if="detail.titolo" />

                <q-card-section>
                  <div class="text-weight-bold q-mb-xs">{{ detail.nome }}</div>
                  <div class="text-grey-8" :class="detail.textClass || ''">{{ detail.valore }}</div>
                </q-card-section>
              </q-card>
            </q-list>
          </div>
          <div v-else class="text-center text-grey q-pa-lg">Seleziona una sezione dal menu</div>
        </q-page>
      </q-page-container>

      <!-- Drawer Navigation -->
      <q-drawer
        v-model="leftDrawerOpen"
        show-if-above
        :mini="miniState"
        @click.capture="drawerClick"
        :width="280"
        :breakpoint="500"
        bordered
        class="bg-grey-1"
      >
        <q-scroll-area class="fit">
          <q-list padding>
            <!-- Back button -->
            <q-item clickable v-ripple @click="goBack">
              <q-item-section avatar>
                <q-icon name="undo" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Torna alla Home</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator class="q-my-md" />

            <!-- Sections -->
            <div v-for="(item, index) in tabsMenuThirdParty" :key="index">
              <!-- Section Header -->
              <q-item-label
                header
                v-if="!item.clickable"
                class="text-uppercase text-weight-bold q-mt-sm"
              >
                {{ item.label }}
              </q-item-label>

              <!-- Clickable Item -->
              <q-item
                v-else
                clickable
                v-ripple
                :active="isSectionActive(item)"
                active-class="bg-primary text-white"
                @click="goTo(item)"
              >
                <q-item-section avatar v-if="item.icon">
                  <q-icon :name="item.icon" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ item.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </div>
          </q-list>
        </q-scroll-area>

        <!-- Mini Toggle -->
        <div class="absolute" style="top: 15px; right: -17px" v-if="!miniState">
          <q-btn
            dense
            round
            unelevated
            color="secondary"
            icon="chevron_left"
            @click="miniState = true"
            size="sm"
          />
        </div>
        <div class="absolute" style="top: 15px; right: -17px" v-if="miniState">
          <q-btn
            dense
            round
            unelevated
            color="secondary"
            icon="chevron_right"
            @click="miniState = false"
            size="sm"
          />
        </div>
      </q-drawer>
    </q-layout>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ITabSelezionati, IDettaglio } from '../types/legal';

const router = useRouter();
const leftDrawerOpen = ref(true);
const miniState = ref(false);
const selectedDettaglio = ref<IDettaglio[]>([]);
const currentSectionName = ref('');

const tabsMenuThirdParty: ITabSelezionati[] = [
  {
    name: 'license-text',
    label: 'TESTO LICENZA',
    clickable: false,
  },
  {
    name: 'mit-license',
    icon: 'gavel',
    label: 'MIT License',
    clickable: true,
    dettagli: [
      {
        icon: 'gavel',
        titolo: 'MIT License',
        nome: 'Copyright (c) 2025 Nurse Hub',
        valore: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
        textClass: 'retro-text',
      },
    ],
  },
  {
    name: 'third-party',
    label: 'LIBRERIE TERZE PARTI',
    clickable: false,
  },
  {
    name: 'framework',
    icon: 'layers',
    label: 'Framework',
    clickable: true,
    dettagli: [
      {
        icon: 'layers',
        titolo: 'Framework Core',
        nome: 'Vue.js',
        valore: 'MIT License',
      },
      {
        nome: 'Quasar Framework',
        valore: 'MIT License',
      },
    ],
  },
  {
    name: 'backend',
    icon: 'cloud',
    label: 'Backend',
    clickable: true,
    dettagli: [
      {
        icon: 'cloud',
        titolo: 'Backend',
        nome: 'Firebase',
        valore: 'Apache 2.0 License',
      },
    ],
  },
];

const drawerClick = () => {
  if (miniState.value) {
    miniState.value = false;
  }
};

const goTo = (item: ITabSelezionati) => {
  if (item.dettagli) {
    selectedDettaglio.value = item.dettagli;
    currentSectionName.value = item.name || '';
  }
};

const goBack = () => {
  void router.push('/');
};

const isSectionActive = (item: ITabSelezionati) => {
  return currentSectionName.value === item.name;
};

// Initialize
const initialSection = tabsMenuThirdParty.find((item) => item.clickable && item.dettagli);
if (initialSection) {
  goTo(initialSection);
}
</script>

<style scoped>
.pages {
  height: 100vh;
}

.retro-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  background-color: #fdf6e3; /* Paper-like background */
  padding: 20px;
  border: 1px solid #d6d6d6;
  border-radius: 2px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
  white-space: pre-wrap;
  text-align: justify;
}
</style>
