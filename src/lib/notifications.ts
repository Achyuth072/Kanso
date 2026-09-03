import { keyStore } from "@/lib/crypto/keyStore";
import { decryptField } from "@/lib/crypto/contentCipher";

export interface EncryptedNotificationBody {
  template: string;
  ciphertext: string;
}

const PLACEHOLDER = "{}";

// Some envs' NotificationOptions type is missing these.
export interface NotificationDisplayOptions extends NotificationOptions {
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
  renotify?: boolean;
  encrypted?: EncryptedNotificationBody;
}

export const DEFAULT_NOTIFICATION_OPTIONS: NotificationDisplayOptions = {
  icon: "/icons/icon-192.png",
  badge: "/icons/icon-192.png",
  vibrate: [200, 100, 200],
};

// Every display goes through here rather than registration.showNotification:
// WebKit never implemented tag coalescing
// (https://bugs.webkit.org/show_bug.cgi?id=258922) and ignores `renotify`, so iOS
// stacks what Chrome replaces unless we close the predecessors ourselves.
export async function displayNotification(
  registration: ServiceWorkerRegistration,
  title: string,
  options?: NotificationDisplayOptions,
): Promise<void> {
  if (options?.tag) {
    await closeNotificationsWithTag(registration, options.tag);
  }

  const { encrypted, ...displayable } = options ?? {};
  if (encrypted) {
    displayable.body = await resolveEncryptedBody(encrypted, displayable.body);
  }

  await registration.showNotification(title, {
    ...DEFAULT_NOTIFICATION_OPTIONS,
    ...displayable,
  } as NotificationOptions);
}

async function resolveEncryptedBody(
  encrypted: EncryptedNotificationBody,
  fallback: string | undefined,
): Promise<string | undefined> {
  try {
    const key = await keyStore.load();
    if (!key) return fallback;
    const plaintext = await decryptField(key, encrypted.ciphertext);
    // Function replacer avoids interpreting "$" in plaintext as special replacement patterns.
    return encrypted.template.replace(PLACEHOLDER, () => plaintext);
  } catch (err) {
    console.warn("[notifications] Could not decrypt notification body", err);
    return fallback;
  }
}

async function closeNotificationsWithTag(
  registration: ServiceWorkerRegistration,
  tag: string,
): Promise<void> {
  try {
    const existing = await registration.getNotifications({ tag });
    for (const notification of existing) {
      notification.close();
    }
  } catch (err) {
    // A duplicate beats nothing: on iOS a push that shows nothing costs the subscription.
    console.warn(
      "[notifications] Could not close superseded notifications",
      err,
    );
    return;
  }
}
