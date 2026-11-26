import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Where uploaded files (textbook PDFs) live.
 *
 * - Backblaze B2 (or any S3-compatible storage) when the STORAGE_* variables are
 *   set — that is the live site. Files are private; readers get a link that works
 *   for one hour.
 * - Otherwise a folder on this computer (`frontend/.data/files`), for local use.
 *
 * Variables: STORAGE_ENDPOINT (e.g. https://s3.us-west-004.backblazeb2.com),
 * STORAGE_REGION (us-west-004), STORAGE_BUCKET, STORAGE_KEY_ID, STORAGE_SECRET.
 */
export interface FileStore {
  readonly kind: "local" | "s3";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  /** The file (or a byte range of it) as a web stream, with its total size. Null if missing. */
  get(key: string, range?: { start: number; end: number }): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  /** Every key under a prefix (e.g. "practice/sets/"), in as few requests as the store allows. */
  list(prefix: string): Promise<Set<string>>;
  /** A short-lived direct link (cloud storage only), so the file doesn't pass through our server. */
  signedUrl?(key: string, seconds: number, contentType?: string): Promise<string>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;
function checkKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Bad storage key: ${key}`);
  return key;
}

function localStore(root: string): FileStore {
  const fileOf = (key: string) => path.join(root, checkKey(key));
  return {
    kind: "local",
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
    async list(prefix) {
      const dir = path.join(root, checkKey(prefix.replace(/\/$/, "")));
      try {
        const names = await readdir(dir, { recursive: true });
        return new Set(names.map((n) => `${prefix.replace(/\/$/, "")}/${String(n).split(path.sep).join("/")}`));
      } catch {
        return new Set();
      }
    },
  };
}

type S3Config = { endpoint: string; region: string; bucket: string; keyId: string; secret: string };

function s3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const { STORAGE_ENDPOINT, STORAGE_REGION, STORAGE_BUCKET, STORAGE_KEY_ID, STORAGE_SECRET } = env;
  if (!STORAGE_ENDPOINT || !STORAGE_BUCKET || !STORAGE_KEY_ID || !STORAGE_SECRET) return null;
  // B2's region is the part of the endpoint after "s3.", e.g. us-west-004.
  const region = STORAGE_REGION || /s3\.([a-z0-9-]+)\./.exec(STORAGE_ENDPOINT)?.[1] || "us-east-1";
  return { endpoint: STORAGE_ENDPOINT.replace(/\/$/, ""), region, bucket: STORAGE_BUCKET, keyId: STORAGE_KEY_ID, secret: STORAGE_SECRET };
}

async function s3Store(cfg: S3Config): Promise<FileStore> {
  const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.keyId, secretAccessKey: cfg.secret },
    // B2 doesn't support the newer default checksums on every request.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = cfg.bucket;
  const missing = (err: unknown) => {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
  };
  return {
    kind: "s3",
    async put(key, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: checkKey(key), Body: data, ContentType: contentType }));
    },
    async size(key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket, Key: checkKey(key) }));
        return head.ContentLength ?? null;
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async get(key, range) {
      try {
        const res = await client.send(
          new GetObjectCommand({ Bucket, Key: checkKey(key), Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
        );
        const total = res.ContentRange ? Number(res.ContentRange.split("/")[1]) : (res.ContentLength ?? 0);
        return { body: res.Body!.transformToWebStream() as ReadableStream<Uint8Array>, size: total };
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: checkKey(key) }));
    },
    async list(prefix) {
      const keys = new Set<string>();
      let token: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix: checkKey(prefix), ContinuationToken: token, MaxKeys: 1000 }));
        for (const o of res.Contents ?? []) if (o.Key) keys.add(o.Key);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
    async signedUrl(key, seconds, contentType = "application/pdf") {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: checkKey(key), ResponseContentType: contentType }), {
        expiresIn: seconds,
      });
    },
  };
}

let store: Promise<FileStore> | null = null;

export function fileStore(): Promise<FileStore> {
  store ??= (async () => {
    const cfg = s3Config();
    return cfg ? s3Store(cfg) : localStore(path.resolve(process.cwd(), ".data/files"));
  })();
  return store;
}

/** True when files go to cloud storage (the live site). */
export function usesCloudStorage(): boolean {
  return s3Config() !== null;
}
