import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** scrypt cost. N=2^15 takes ~50 ms: slow enough against guessing, fast enough for a serverless function. */
// Tests set SCRYPT_LOG2_N lower to run fast; the cost is stored in each hash, so old hashes still verify.
const PARAMS = { N: 2 ** Number(process.env.SCRYPT_LOG2_N || 15), r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LEN = 32;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Stored as `scrypt$N$r$p$salt$hash` (base64url), so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash that never matches; checked against when the username doesn't exist, so timing doesn't reveal it. */
export const DUMMY_HASH = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// Simple English words a Class 4 child can read and type on a phone keyboard.
const WORDS = [
  "mango", "lotus", "tiger", "river", "cloud", "kite", "drum", "star", "leaf", "peacock",
  "banyan", "rain", "sun", "moon", "boat", "lamp", "bell", "rose", "jasmine", "coconut",
  "parrot", "camel", "eagle", "pearl", "honey", "spark", "brick", "plant", "wheel", "chalk",
  "ocean", "hill", "tree", "seed", "ruby", "cobra", "lemon", "grape", "flute", "veena",
] as const;

/**
 * A student password such as "lotus4827": easy to read out and type.
 * About 19 bits — weak on its own, which is why sign-in locks after repeated misses.
 */
export function studentPassword(): string {
  return `${WORDS[randomInt(WORDS.length)]}${randomInt(1000, 10000)}`;
}

/** A staff password such as "river-mango-4827-kite" (~44 bits). */
export function staffPassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${randomInt(1000, 10000)}-${w()}`;
}

export const MIN_STUDENT_PASSWORD = 6;
export const MIN_STAFF_PASSWORD = 10;
