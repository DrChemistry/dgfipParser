<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import DropZone from "./components/DropZone.vue";
import ResultsList from "./components/ResultsList.vue";
import { makeInitialReport, processFile } from "./lib/report";
import type { FileReport } from "./lib/report";
import { runWithConcurrency } from "./lib/queue";

const reports = reactive<FileReport[]>([]);
const isProcessing = ref(false);

const progress = computed(() => {
  const total = reports.length;
  if (total === 0) return null;
  const done = reports.filter(
    (r) => r.status === "done" || r.status === "error",
  ).length;
  return { done, total };
});

async function onPaths(paths: string[]) {
  // Skip duplicates already queued.
  const known = new Set(reports.map((r) => r.path));
  const newPaths = paths.filter((p) => !known.has(p));
  if (newPaths.length === 0) return;

  // Each row must be a reactive object we keep a reference to. If we push a
  // plain object, Vue stores a proxy in the array while `newReports` still held
  // raw objects — `processFile` would mutate the raw copy and the UI would stay
  // stuck on "Analyse en cours".
  const newReports = newPaths.map((p) => reactive(makeInitialReport(p)));
  for (const r of newReports) reports.push(r);

  isProcessing.value = true;
  try {
    await runWithConcurrency(
      newReports.map((report) => () => processFile(report)),
      4,
    );
  } finally {
    isProcessing.value =
      reports.some((r) => r.status === "processing" || r.status === "pending");
  }
}

function clearAll() {
  reports.splice(0, reports.length);
}
</script>

<template>
  <main class="app">
    <header class="title">
      <h1>DGFIP Parser</h1>
      <p>
        Analyse hors-ligne des PDF a la recherche de
        <strong>"TOTAL RESTE A PAYER"</strong> &gt; 50 000,00 &euro;.
      </p>
    </header>

    <DropZone :disabled="isProcessing" @paths="onPaths" />

    <p v-if="progress" class="progress">
      {{ progress.done }} / {{ progress.total }} fichier(s) traite(s)
    </p>

    <ResultsList :reports="reports" @clear="clearAll" />
  </main>
</template>

<style scoped>
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.title h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.title p {
  margin: 0;
  color: var(--text-muted);
}

.progress {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
}
</style>
