import sodium from "libsodium-wrappers-sumo";

// libsodium-wrappers-sumo is required because standard libsodium-wrappers omits crypto_pwhash (Argon2id).
let readyPromise: Promise<typeof sodium> | null = null;

export function getSodium(): Promise<typeof sodium> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}
