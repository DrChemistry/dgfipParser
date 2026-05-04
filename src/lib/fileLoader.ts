// Bridges the Tauri filesystem and dialog plugins so the rest of the frontend
// can work in terms of "give me PDFs from these paths".

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile, stat, readDir } from "@tauri-apps/plugin-fs";

const PDF_EXT = /\.pdf$/i;

/**
 * Walks a directory tree and returns absolute paths to every *.pdf file.
 * Symlinks are followed via stat so we don't infinite-loop on cycles (we
 * dedupe by path).
 */
export async function listPdfsInDirectory(
  rootPath: string,
): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];

  const walk = async (dirPath: string) => {
    let entries;
    try {
      entries = await readDir(dirPath);
    } catch {
      // Permissions, broken link, etc. Skip silently.
      return;
    }
    for (const entry of entries) {
      const childPath = joinPath(dirPath, entry.name);
      if (seen.has(childPath)) continue;
      seen.add(childPath);
      if (entry.isDirectory) {
        await walk(childPath);
      } else if (entry.isFile && PDF_EXT.test(entry.name)) {
        out.push(childPath);
      } else if (entry.isSymlink) {
        // Resolve the symlink target by stat'ing it.
        try {
          const info = await stat(childPath);
          if (info.isDirectory) {
            await walk(childPath);
          } else if (info.isFile && PDF_EXT.test(entry.name)) {
            out.push(childPath);
          }
        } catch {
          // dangling link
        }
      }
    }
  };

  await walk(rootPath);
  return out;
}

/**
 * Given a mixed list of file and directory paths (e.g. as produced by a
 * drag-drop event), returns the flattened list of *.pdf files to process.
 * Paths that point to non-PDF files are silently dropped.
 */
export async function expandToPdfPaths(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const path of paths) {
    let info;
    try {
      info = await stat(path);
    } catch {
      continue;
    }
    if (info.isDirectory) {
      const found = await listPdfsInDirectory(path);
      out.push(...found);
    } else if (info.isFile && PDF_EXT.test(path)) {
      out.push(path);
    }
  }
  // Dedupe while preserving order.
  return Array.from(new Set(out));
}

/**
 * Opens the native folder picker. Returns null if the user cancelled.
 */
export async function pickFolder(): Promise<string | null> {
  const selection = await openDialog({
    directory: true,
    multiple: false,
    title: "Selectionner un dossier de PDFs",
  });
  if (!selection) return null;
  return Array.isArray(selection) ? selection[0] ?? null : selection;
}

/**
 * Opens the native file picker, restricted to PDFs.
 */
export async function pickPdfFiles(): Promise<string[]> {
  const selection = await openDialog({
    multiple: true,
    title: "Selectionner des PDFs",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!selection) return [];
  return Array.isArray(selection) ? selection : [selection];
}

/**
 * Reads a PDF off disk and returns its bytes.
 */
export async function readPdfBytes(path: string): Promise<Uint8Array> {
  return readFile(path);
}

// Tauri exposes paths in OS-native form. We assemble paths with the same
// separator we observed on the input so we don't break Windows' "C:\\" or
// POSIX' "/".
function joinPath(parent: string, child: string): string {
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return parent + child;
  }
  const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
  return parent + sep + child;
}

/**
 * Returns just the file name portion of a path (last segment).
 */
export function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx === -1 ? path : path.slice(idx + 1);
}
