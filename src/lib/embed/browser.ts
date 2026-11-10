import type { EmbedModel, Embedded, Embedder } from "@/lib/rag/types";
import type { WorkerRequest, WorkerResponse } from "./worker";

/**
 * The embedder in a Web Worker. Resolves once the model is in memory;
 * `onLoad` reports the download (bytes so far, bytes in all) on a first
 * visit, and is silent when the browser already has the files.
 */
export function browserEmbedder(model: EmbedModel, onLoad?: (loaded: number, total: number) => void): Promise<Embedder & { dispose: () => void }> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  const send = (request: WorkerRequest) => worker.postMessage(request);
  let nextId = 1;
  const pending = new Map<number, { resolve: (items: Embedded[]) => void; reject: (error: Error) => void; onProgress?: (done: number, total: number) => void }>();

  return new Promise((resolve, reject) => {
    worker.onerror = (event) => reject(new Error(event.message || "The embedding worker failed to start"));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") onLoad?.(message.loaded, message.total);
      else if (message.type === "ready") {
        resolve({
          model,
          embed: (texts, kind, onProgress) =>
            new Promise<Embedded[]>((done, fail) => {
              const id = nextId++;
              pending.set(id, { resolve: done, reject: fail, onProgress });
              send({ type: "embed", id, texts, kind });
            }),
          dispose: () => worker.terminate(),
        });
      } else if (message.type === "embed-progress") pending.get(message.id)?.onProgress?.(message.done, message.total);
      else if (message.type === "embedded") {
        const request = pending.get(message.id);
        pending.delete(message.id);
        request?.resolve(message.vectors.map((vector, i) => ({ vector, tokens: message.tokens[i], truncated: message.truncated[i] })));
      } else if (message.type === "error") {
        const error = new Error(message.message);
        if (message.id === null) reject(error);
        else {
          pending.get(message.id)?.reject(error);
          pending.delete(message.id);
        }
      }
    };
    send({ type: "load", model });
  });
}
