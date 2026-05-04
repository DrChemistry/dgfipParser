<script setup lang="ts">
import { computed } from "vue";
import { buildCsv, downloadCsv } from "../lib/csv";
import type { FileReport } from "../lib/report";
import FileResult from "./FileResult.vue";

const props = defineProps<{
  reports: FileReport[];
}>();

const emit = defineEmits<{
  (e: "clear"): void;
}>();

const totals = computed(() => {
  let processed = 0;
  let withMatches = 0;
  let totalMatches = 0;
  let errors = 0;
  for (const r of props.reports) {
    if (r.status === "done") processed++;
    if (r.status === "error") errors++;
    if (r.matches.length > 0) withMatches++;
    totalMatches += r.matches.length;
  }
  return {
    total: props.reports.length,
    processed,
    withMatches,
    totalMatches,
    errors,
  };
});

const allDone = computed(() =>
  props.reports.every((r) => r.status === "done" || r.status === "error"),
);

const sortedReports = computed(() => {
  // Show files with hits first, then plain files, errors last.
  const order = (r: FileReport) => {
    if (r.status === "error") return 2;
    if (r.matches.length > 0) return 0;
    return 1;
  };
  return [...props.reports].sort(
    (a, b) => order(a) - order(b) || a.name.localeCompare(b.name, "fr"),
  );
});

function exportCsv() {
  const csv = buildCsv(props.reports);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadCsv(`dgfip-rapport-${stamp}.csv`, csv);
}
</script>

<template>
  <section v-if="reports.length > 0" class="results">
    <header class="summary">
      <div class="counts">
        <span
          ><strong>{{ totals.total }}</strong> fichier(s)</span
        >
        <span class="sep">&middot;</span>
        <span>{{ totals.processed }} analyse(s)</span>
        <span class="sep">&middot;</span>
        <span class="hit"
          >{{ totals.withMatches }} avec montant &gt; seuil</span
        >
        <span class="sep">&middot;</span>
        <span>{{ totals.totalMatches }} occurrence(s)</span>
        <span v-if="totals.errors > 0" class="sep">&middot;</span>
        <span v-if="totals.errors > 0" class="error">
          {{ totals.errors }} erreur(s)
        </span>
      </div>
      <div class="actions">
        <button
          :disabled="!allDone || totals.totalMatches === 0"
          @click="exportCsv"
        >
          Exporter en CSV
        </button>
        <button @click="emit('clear')">Effacer</button>
      </div>
    </header>

    <div class="list">
      <FileResult
        v-for="report in sortedReports"
        :key="report.path"
        :report="report"
      />
    </div>
  </section>
</template>

<style scoped>
.results {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  color: var(--text-muted);
}

.counts strong {
  color: var(--text);
}

.counts .hit {
  color: var(--warning);
}

.counts .error {
  color: var(--danger);
}

.sep {
  opacity: 0.5;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
