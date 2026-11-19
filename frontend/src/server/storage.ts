import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Where uploaded files (textbook PDFs) live.
 *
 * Now: a folder on this computer (`frontend/.data/files`). That works for local
 * use and a single server, but not on Vercel, whose disk is wiped between requests
 * and whose uploads are capped at 4.5 MB. Before going live this gets a Cloudflare
 * R2 implementation of the same three functions (docs/platform-build-plan.md §3.2),
 * with the browser uploading straight to R2.
 */
export interface FileStore {
  put(key: string, data: Uint8Array): Promise<void>;
  /** The file (or a byte range of it) as a web stream, with its total size. Null if missing. */
  get(key: string, range?: { start: number; end: number }): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

function localStore(root: string): FileStore {
  const fileOf = (key: string) => {
    if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Bad storage key: ${key}`);
    return path.join(root, key);
  };
  return {
    async put(key, data) {
      const file = fileOf(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
    },
    async size(key) {
      try {
        return (await stat(fileOf(key))).size;
      } catch {
        return null;
      }
    },
    async get(key, range) {
      const size = await this.size(key);
      if (size === null) return null;
      const stream = createReadStream(fileOf(key), range ? { start: range.start, end: range.end } : undefined);
      return { body: Readable.toWeb(stream) as ReadableStream<Uint8Array>, size };
    },
    async remove(key) {
      await rm(fileOf(key), { force: true });
    },
  };
}

let store: FileStore | null = null;

export function fileStore(): FileStore {
  store ??= localStore(path.resolve(process.cwd(), ".data/files"));
  return store;
}
