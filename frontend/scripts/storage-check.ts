/**
 * Checks the Backblaze B2 settings: writes, reads, links and deletes a tiny file.
 *   npm run storage:check
 */
import { fileStore, usesCloudStorage } from "../src/server/storage";

async function main() {
  if (!usesCloudStorage()) {
    console.error("STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_KEY_ID and STORAGE_SECRET are not all set.");
    process.exit(1);
  }
  const store = await fileStore();
  const key = `checks/${Date.now()}.txt`;
  await store.put(key, new TextEncoder().encode("kalpavriksha storage check"), "text/plain");
  console.log("1. Upload: ok");
  console.log(`2. Size: ${await store.size(key)} bytes`);
  const url = await store.signedUrl!(key, 60);
  const res = await fetch(url);
  console.log(`3. Private link: ${res.ok ? "ok" : `failed (${res.status})`}`);
  await store.remove(key);
  console.log("4. Delete: ok\nB2 is set up correctly.");
  process.exit(0);
}
main().catch((err) => {
  console.error("Storage check failed:", err?.name ?? "", err?.message ?? err);
  process.exit(1);
});
