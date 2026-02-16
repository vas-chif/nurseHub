<template>
  <div class="pages" aria-label="Privacy Page">
    <q-layout view="hHh lpR fFf" class="rounded-borders">
      <q-header elevated class="bg-primary text-white">
        <q-toolbar class="q-mt-lg">
          <q-btn flat @click="leftDrawerOpen = !leftDrawerOpen" round dense icon="menu" />
          <q-toolbar-title class="head-3 column">
            <div>Privacy Policy</div>
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
                <q-avatar icon="privacy_tip" color="primary" text-color="white" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-h6">{{ informativa[0]?.title }}</q-item-label>
                <q-item-label caption>{{ informativa[1]?.subtitle }}</q-item-label>
              </q-item-section>
            </template>

            <q-card>
              <q-card-section>
                <div class="text-body1">{{ informativa[2]?.paragrafo }}</div>
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
                  <div class="text-grey-8">{{ detail.valore }}</div>
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
            <q-item
              v-for="(item, index) in btnTab"
              :key="'btn-' + index"
              clickable
              v-ripple
              @click="item.clickable && goBack()"
            >
              <q-item-section avatar>
                <q-icon :name="item.icon" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.label }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator class="q-my-md" />

            <!-- Sections -->
            <template
              v-for="(section, sIndex) in [
                tabsMenuPrivacyTratamento,
                tabsMenuPrivacyRuoli,
                tabsMenuPrivacyNote,
              ]"
              :key="sIndex"
            >
              <div v-for="(item, iIndex) in section" :key="sIndex + '-' + iIndex">
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
              <q-separator class="q-my-sm" v-if="sIndex < 2" />
            </template>

            <q-separator class="q-my-md" />

            <q-item clickable v-ripple to="/terms">
              <q-item-section avatar>
                <q-icon name="description" color="primary" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Termini e Condizioni</q-item-label>
              </q-item-section>
            </q-item>
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
import {
  informativa,
  btnTab,
  tabsMenuPrivacyTratamento,
  tabsMenuPrivacyRuoli,
  tabsMenuPrivacyNote,
} from '../data/privacy';
import type { ITabSelezionati, IDettaglio } from '../types/legal';

const router = useRouter();
const leftDrawerOpen = ref(true);
const miniState = ref(false);
const selectedDettaglio = ref<IDettaglio[]>([]);
const currentSectionName = ref('');

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
const initialSection = tabsMenuPrivacyTratamento.value.find(
  (item) => item.clickable && item.dettagli,
);
if (initialSection) {
  goTo(initialSection);
}
</script>

<style scoped>
.pages {
  height: 100vh;
}
</style>
