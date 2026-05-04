<script setup lang="ts">
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { expandToPdfPaths, pickFolder, pickPdfFiles } from "../lib/fileLoader";

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "paths", paths: string[]): void;
}>();

const isDragging = ref(false);
let unlisten: (() => void) | null = null;

async function handlePaths(paths: string[]) {
  if (props.disabled) return;
  if (paths.length === 0) return;
  const expanded = await expandToPdfPaths(paths);
  if (expanded.length > 0) {
    emit("paths", expanded);
  }
}

async function onClickFolder() {
  if (props.disabled) return;
  const folder = await pickFolder();
  if (folder) await handlePaths([folder]);
}

async function onClickFiles() {
  if (props.disabled) return;
  const files = await pickPdfFiles();
  if (files.length > 0) await handlePaths(files);
}

onMounted(async () => {
  // Tauri 2 emits a single drag-drop event on the webview with a discriminator.
  unlisten = await getCurrentWebview().onDragDropEvent((event) => {
    const payload = event.payload;
    switch (payload.type) {
      case "enter":
      case "over":
        isDragging.value = !props.disabled;
        break;
      case "leave":
        isDragging.value = false;
        break;
      case "drop":
        isDragging.value = false;
        void handlePaths(payload.paths);
        break;
    }
  });
});

onBeforeUnmount(() => {
  unlisten?.();
});
</script>

<template>
  <section
    class="drop-zone"
    :class="{ dragging: isDragging, disabled: props.disabled }"
    aria-label="Zone de depot des PDFs"
  >
    <div class="hint">
      <h2>Deposer des PDFs ou un dossier ici</h2>
      <p>
        L'application analyse chaque fichier localement et signale les montants
        <strong>strictement superieurs a 50 000,00 &euro;</strong> trouvés après
        la mention <em>TOTAL RESTE A PAYER</em>.
      </p>
    </div>
    <div class="actions">
      <button class="primary" :disabled="props.disabled" @click="onClickFolder">
        Choisir un dossier
      </button>
      <button :disabled="props.disabled" @click="onClickFiles">
        Choisir des fichiers
      </button>
    </div>
  </section>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  background: var(--bg-elevated);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.drop-zone.dragging {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.drop-zone.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.hint h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  font-weight: 600;
}

.hint p {
  margin: 0 0 1.5rem;
  color: var(--text-muted);
  max-width: 48ch;
  margin-left: auto;
  margin-right: auto;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}
</style>
