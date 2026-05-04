<script setup lang="ts">
import { computed, ref } from "vue";
import { formatAmount } from "../lib/amountParser";
import type { FileReport } from "../lib/report";

const props = defineProps<{
  report: FileReport;
}>();

// Files with hits open by default; clean files start collapsed.
const expanded = ref(props.report.matches.length > 0);

const statusLabel = computed(() => {
  switch (props.report.status) {
    case "pending":
      return "En attente";
    case "processing":
      return "Analyse en cours";
    case "done":
      return props.report.matches.length > 0
        ? `${props.report.matches.length} montant(s) au-dessus du seuil`
        : "Aucun montant au-dessus du seuil";
    case "error":
      return "Erreur";
  }
});

const variant = computed(() => {
  if (props.report.status === "error") return "error";
  if (props.report.status === "processing") return "processing";
  if (props.report.status === "pending") return "pending";
  return props.report.matches.length > 0 ? "hit" : "ok";
});

function toggle() {
  if (props.report.status === "done" || props.report.status === "error") {
    expanded.value = !expanded.value;
  }
}
</script>

<template>
  <article class="file-result" :data-variant="variant">
    <header class="head" @click="toggle">
      <span class="dot" :data-variant="variant" aria-hidden="true" />
      <span class="name" :title="report.path">{{ report.name }}</span>
      <span class="status">{{ statusLabel }}</span>
      <span
        v-if="report.status === 'done' || report.status === 'error'"
        class="caret"
        aria-hidden="true"
        >{{ expanded ? "v" : ">" }}</span
      >
    </header>

    <div v-if="expanded" class="body">
      <p v-if="report.status === 'error'" class="error">
        {{ report.error }}
      </p>
      <ul v-else-if="report.matches.length > 0" class="matches">
        <li v-for="(m, i) in report.matches" :key="i">
          <span class="page">Page {{ m.page }}</span>
          <span class="amount">{{ formatAmount(m.amount) }}</span>
          <span class="line">{{ m.line }}</span>
        </li>
      </ul>
      <p v-else-if="report.status === 'done'" class="empty">
        Aucune occurrence de "TOTAL RESTE A PAYER" supérieure a 50 000,00 &euro;
        n'a été trouvée dans ce fichier
        <span v-if="report.pageCount"> ({{ report.pageCount }} page(s)).</span>
      </p>
    </div>
  </article>
</template>

<style scoped>
.file-result {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  overflow: hidden;
}

.head {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
}

.head:hover {
  background: var(--bg-hover);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}
.dot[data-variant="ok"] {
  background: var(--success);
}
.dot[data-variant="hit"] {
  background: var(--warning);
}
.dot[data-variant="error"] {
  background: var(--danger);
}
.dot[data-variant="processing"] {
  background: var(--accent);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.caret {
  color: var(--text-muted);
  font-family: monospace;
  width: 1ch;
  text-align: center;
}

.body {
  border-top: 1px solid var(--border);
  padding: 0.75rem 1rem 1rem;
  background: var(--bg);
}

.matches {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.matches li {
  display: grid;
  grid-template-columns: 6rem 9rem 1fr;
  gap: 0.75rem;
  align-items: baseline;
  padding: 0.4rem 0.5rem;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.page {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.amount {
  color: var(--warning);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.line {
  color: var(--text);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error {
  color: var(--danger);
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
}

.empty {
  color: var(--text-muted);
  margin: 0;
  font-size: 0.9rem;
}
</style>
