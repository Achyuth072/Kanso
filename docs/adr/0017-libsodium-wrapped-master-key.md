# One wrapped master key, libsodium everywhere, key storage behind a seam

Content is encrypted with a single random **master key** using
XChaCha20-Poly1305, via libsodium on every platform. The master key is never
derived from anything — it is generated once and stored **wrapped**, encrypted
separately by each unlock method (an Argon2id-derived passphrase key, and a
recovery code). Where that wrapped blob and the unwrapped key live is hidden
behind a small `KeyStore` seam: IndexedDB in the browser, the OS keychain on
Capacitor and Tauri.

Two properties fall out of this, and both are the point. Changing a passphrase
rewraps one small blob instead of re-encrypting the entire dataset. And adding a
future unlock method — WebAuthn PRF, platform biometrics — is a new wrapper, not
a migration.

## Considered options

- **Deriving the content key directly from the passphrase.** Rejected: a
  passphrase change would then re-encrypt every row, and a second unlock method
  would be impossible to add without one.
- **libsodium for key derivation, then a non-extractable WebCrypto `CryptoKey`
  for content.** Recommended for two rounds of design, then rejected on four
  counts. It optimises for a service worker that Capacitor iOS does not have
  (Web Push does not work in a `WKWebView`; native APNs is used instead), so the
  mechanism disappears at the native migration. It reintroduces a Safari version
  floor that libsodium avoids entirely. It buys less than it appears to —
  decrypting a wrapped non-extractable key can yield an extractable one. And
  Notesnook, an audited open-source product in the same position, ships
  libsodium-only.
- **AES-GCM instead of XChaCha20-Poly1305.** Rejected on nonces: 96 bits leaves
  no headroom for an offline-first app where several devices encrypt
  concurrently with no way to coordinate. XChaCha20's 192-bit nonce makes random
  nonces safe indefinitely.
- **PIN unlock, as a convenience.** Rejected outright. Bitwarden ships it and it
  is a documented hole: the PIN-derived key wraps the account key on disk, the
  guess limit is enforced only inside the client, and an attacker attacking the
  ciphertext directly has 10,000 possibilities to try offline.
- **WebAuthn PRF as the sole key source.** Rejected: deleting a passkey would
  destroy the data, since the credential and the key would be the same thing.
  The wrapped-key design is precisely the recommended alternative, and leaves PRF
  available later as one wrapper among several.

## Consequences

- **A browser client cannot be made immune to XSS, and this design does not
  claim to be.** Injected script runs in the same origin with the same
  authority. E2EE is the boundary against the _server_; the frontend security
  stack — CSP, Trusted Types, dependency and build integrity — is what protects
  the client-side copy of the key. Those are separate controls with separate
  threat models, and neither substitutes for the other. `connect-src` deserves
  particular attention: it is what blocks a successful injection from _sending
  the key anywhere_.
- **The native shells are a security upgrade, not only a distribution channel.**
  The keychain is hardware-backed and the WebView carries no extensions or
  third-party scripts. It does not make a compromised frontend harmless, but it
  meaningfully reduces the blast radius — and requires no change to the
  cryptography, only a different `KeyStore`.
- **Every ciphertext carries a scheme and key identifier.** Rotation is not
  built now, but it is the only remediation that exists if a key ever leaks, and
  retrofitting version tags across a populated database is a migration worth
  avoiding. Rotation itself is deferred deliberately: it re-encrypts the whole
  dataset, and Bitwarden's own guidance warns that a session holding a stale key
  during rotation causes unrecoverable corruption — a hazard that is worse here,
  because offline multi-device is our normal state rather than an edge case.
- **The device holds plaintext, by necessity.** The persisted query cache and
  the unwrapped key both live on disk so the app works offline and the service
  worker can render reminders. Signing out or locking must purge all of it —
  key, decrypted cache, pending payloads — or the server is zero-knowledge while
  the device is not.
- **libsodium is a real bundle cost** (roughly 375KB gzipped for the build that
  includes Argon2) on an app people install. Accepted for portability: the same
  code runs unchanged in a browser, a Capacitor WebView, a Tauri WebView and
  Node.
- **Ciphertext is stored base64 in the existing `TEXT` columns**, not `bytea`.
  Raw byte arrays are mangled through PostgREST and double-encoded by Realtime;
  base64 costs about a third more storage and no column type changes at all.
