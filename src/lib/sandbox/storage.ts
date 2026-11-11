/**
 * Where sandboxes live between visits: one IndexedDB store in this
 * browser, keyed by id. Nothing leaves the machine. When the browser has
 * no IndexedDB to give (some private windows), the same functions work on
 * memory and last as long as the tab.
 */
import { DEFAULT_SETTINGS } from "@/lib/rag/settings";
import type { StoredSandbox } from "./types";

const DATABASE = "ragui";
const STORE = "sandboxes";

const memory = new Map<string, StoredSandbox>();
let opening: Promise<IDBDatabase | null> | null = null;

function database(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>, fallback: () => T): Promise<T> {
  const db = await database();
  if (!db) return fallback();
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The browser refused to store the data"));
  });
}

/** Every stored sandbox, the most recently changed first. */
export async function listSandboxes(): Promise<StoredSandbox[]> {
  const all = await run("readonly", (store) => store.getAll() as IDBRequest<StoredSandbox[]>, () => [...memory.values()]);
  return all.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

export async function loadSandbox(id: string): Promise<StoredSandbox | null> {
  return (await run("readonly", (store) => store.get(id) as IDBRequest<StoredSandbox | undefined>, () => memory.get(id))) ?? null;
}

export async function saveSandbox(record: StoredSandbox): Promise<void> {
  await run("readwrite", (store) => store.put(record) as IDBRequest<unknown>, () => memory.set(record.id, record));
}

export async function deleteSandbox(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id) as IDBRequest<unknown>, () => memory.delete(id));
}

/** A new, empty sandbox with the default settings, stored and returned. */
export async function createSandbox(name: string): Promise<StoredSandbox> {
  const now = Date.now();
  const record: StoredSandbox = { id: crypto.randomUUID().slice(0, 8), name: name.trim(), preset: false, docs: [], settings: DEFAULT_SETTINGS, history: [], createdAt: now, updatedAt: now };
  await saveSandbox(record);
  return record;
}
