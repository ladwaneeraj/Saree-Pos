/**
 * Collision-resistant ids that work in insecure contexts too (crypto.randomUUID needs HTTPS,
 * which a demo opened over a LAN IP does not have).
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(prefix = ""): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  let out = Date.now().toString(36);
  for (const b of bytes) out += ALPHABET[b % 36];
  return prefix ? `${prefix}_${out}` : out;
}
