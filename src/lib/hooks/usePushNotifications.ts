"use client";

import { useState, useEffect, useCallback } from "react";
import { useUiStore } from "@/lib/store/uiStore";
import { removePushSubscription, syncPushSubscription } from "@/lib/push-api";

export type NotificationPermission = "default" | "granted" | "denied";

interface SubscribeOptions {
  forceRefresh?: boolean;
}

export interface PushPermissionResult {
  permission: NotificationPermission;
  subscription: PushSubscription | null;
}

export function usePushNotifications() {
  const notificationsEnabled = useUiStore(
    (state) => state.notificationsEnabled,
  );
  const setNotificationsEnabled = useUiStore(
    (state) => state.setNotificationsEnabled,
  );
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    return (Notification.permission as NotificationPermission) || "default";
  });
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  });
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  // Helper to wait for service worker with timeout
  const getServiceWorkerRegistration = useCallback(async () => {
    const swPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Service worker registration timeout")),
        5000,
      ),
    );
    return Promise.race([swPromise, timeoutPromise]);
  }, []);

  const sendSubscriptionToBackend = useCallback(
    async (sub: PushSubscription) => {
      await syncPushSubscription(sub);
    },
    [],
  );

  const removeSubscriptionFromBackend = useCallback(
    async (endpoint: string) => {
      try {
        await removePushSubscription(endpoint);
      } catch (error) {
        console.error("Error removing subscription from backend:", error);
      }
    },
    [],
  );

  const clearExistingSubscription = useCallback(
    async (sub: PushSubscription) => {
      try {
        await sub.unsubscribe();
      } catch (error) {
        console.error("Error unsubscribing from push service:", error);
      }

      await removeSubscriptionFromBackend(sub.endpoint);
    },
    [removeSubscriptionFromBackend],
  );

  const subscribeToPush = useCallback(
    async (
      permissionOverride?: NotificationPermission,
      options?: SubscribeOptions,
    ): Promise<PushSubscription | null> => {
      const effectivePermission = permissionOverride || permission;
      if (!isSupported || effectivePermission !== "granted") {
        return null;
      }

      try {
        setIsSyncing(true);
        const registration = await getServiceWorkerRegistration();

        let sub = await registration.pushManager.getSubscription();

        if (sub && options?.forceRefresh) {
          await clearExistingSubscription(sub);
          sub = null;
        }

        if (!sub) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

          if (!vapidPublicKey) {
            console.error("VAPID public key not configured");
            return null;
          }

          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              vapidPublicKey,
            ) as BufferSource,
          });
        }

        setSubscription(sub);
        await sendSubscriptionToBackend(sub);

        // Finally enable notifications in store only after everything is synced
        setNotificationsEnabled(true);

        return sub;
      } catch (error) {
        console.error("Error subscribing to push notifications:", error);
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      isSupported,
      permission,
      clearExistingSubscription,
      sendSubscriptionToBackend,
      getServiceWorkerRegistration,
      setNotificationsEnabled,
    ],
  );

  const requestPermission = useCallback(
    async (options?: SubscribeOptions): Promise<PushPermissionResult> => {
      if (!isSupported) {
        return { permission: "denied", subscription: null };
      }

      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermission);

        let sub: PushSubscription | null = null;

        if (result === "granted") {
          // Note: subscribeToPush now handles setNotificationsEnabled(true) on success
          sub = await subscribeToPush(
            result as NotificationPermission,
            options,
          );
        }

        return {
          permission: result as NotificationPermission,
          subscription: sub,
        };
      } catch (error) {
        console.error("Error requesting notification permission:", error);
        return { permission: "denied", subscription: null };
      }
    },
    [isSupported, subscribeToPush],
  );

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      let sub = subscription;

      if (!sub) {
        const registration = await getServiceWorkerRegistration();
        sub = await registration.pushManager.getSubscription();
      }

      if (sub) {
        await clearExistingSubscription(sub);
      }

      setSubscription(null);
      setNotificationsEnabled(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      return false;
    }
  }, [
    subscription,
    clearExistingSubscription,
    getServiceWorkerRegistration,
    setNotificationsEnabled,
  ]);

  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions): Promise<void> => {
      if (!isSupported || permission !== "granted") {
        return;
      }

      try {
        const registration = await getServiceWorkerRegistration();
        await registration.showNotification(title, {
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [200, 100, 200],
          ...options,
        } as NotificationOptions);
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    },
    [isSupported, permission, getServiceWorkerRegistration],
  );

  useEffect(() => {
    if (isSupported && notificationsEnabled) {
      const initSubscription = async () => {
        try {
          const registration = await getServiceWorkerRegistration();
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            setSubscription(sub);
            await sendSubscriptionToBackend(sub);
          } else if (permission === "granted") {
            await subscribeToPush();
          }
        } catch (error) {
          console.error("Error initializing push subscription:", error);
        }
      };
      initSubscription();
    }
  }, [
    isSupported,
    notificationsEnabled,
    permission,
    sendSubscriptionToBackend,
    subscribeToPush,
    getServiceWorkerRegistration,
  ]);

  return {
    isSupported,
    permission,
    notificationsEnabled,
    subscription,
    isSyncing,
    requestPermission,
    subscribeToPush,
    unsubscribe,
    showNotification,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
