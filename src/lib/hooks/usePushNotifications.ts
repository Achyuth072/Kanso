"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import { useUiStore } from "@/lib/store/uiStore";
import { removePushSubscription, syncPushSubscription } from "@/lib/push-api";
import { displayNotification } from "@/lib/notifications";
import { useAuth } from "@/components/AuthProvider";

type NotificationPermission = "default" | "granted" | "denied";

interface SubscribeOptions {
  forceRefresh?: boolean;
}

interface PushPermissionResult {
  permission: NotificationPermission;
  subscription: PushSubscription | null;
}

export function usePushNotifications() {
  const { isGuestMode } = useAuth();
  const notificationsEnabled = useUiStore(
    (state) => state.notificationsEnabled,
  );
  const setNotificationsEnabled = useUiStore(
    (state) => state.setNotificationsEnabled,
  );
  // iOS Safari/Chrome tabs lack `Notification` (only present when installed
  // as a home-screen PWA) — reading `.permission` there throws.
  const supportsNotificationApi =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supportsNotificationApi
      ? (Notification.permission as NotificationPermission)
      : "default",
  );
  const [isSupported] = useState(() => supportsNotificationApi);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const subscriptionEndpointRef = useRef<string | null>(null);

  const getServiceWorkerRegistration = useCallback(async () => {
    // Fail fast in dev without ENABLE_PWA=true, instead of hanging on `ready`
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) {
      throw new Error("No service worker registered");
    }
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
      if (isGuestMode) return;
      await syncPushSubscription(sub);
    },
    [isGuestMode],
  );

  const removeSubscriptionFromBackend = useCallback(
    async (endpoint: string) => {
      if (isGuestMode) return;
      try {
        await removePushSubscription(endpoint);
      } catch (error) {
        Sentry.captureException(error);
      }
    },
    [isGuestMode],
  );

  const clearExistingSubscription = useCallback(
    async (sub: PushSubscription) => {
      try {
        await sub.unsubscribe();
      } catch (error) {
        Sentry.captureException(error);
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
      if (isGuestMode) return null;
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
      isGuestMode,
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
      if (isGuestMode || !isSupported) {
        return { permission: "denied", subscription: null };
      }

      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermission);

        let sub: PushSubscription | null = null;

        if (result === "granted") {
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
    [isGuestMode, isSupported, subscribeToPush],
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
        await displayNotification(registration, title, options);
      } catch (error) {
        Sentry.captureException(error);
      }
    },
    [isSupported, permission, getServiceWorkerRegistration],
  );

  useEffect(() => {
    if (isGuestMode || !isSupported || !notificationsEnabled) return;
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
        Sentry.captureException(error);
      }
    };
    initSubscription();
  }, [
    isGuestMode,
    isSupported,
    notificationsEnabled,
    permission,
    sendSubscriptionToBackend,
    subscribeToPush,
    getServiceWorkerRegistration,
  ]);

  useEffect(() => {
    if (subscription) {
      subscriptionEndpointRef.current = subscription.endpoint;
    }
  }, [subscription]);

  // Re-validate on tab focus to catch Chrome Android's auto-rotated subscriptions
  useEffect(() => {
    if (isGuestMode || !isSupported || !notificationsEnabled) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const registration = await getServiceWorkerRegistration();
        const currentSub = await registration.pushManager.getSubscription();

        if (currentSub) {
          if (currentSub.endpoint !== subscriptionEndpointRef.current) {
            console.log(
              "[Push] Subscription endpoint changed, syncing new endpoint",
            );
          }

          // Sync unconditionally — freshness matters even if unchanged
          setSubscription(currentSub);
          await sendSubscriptionToBackend(currentSub);
          subscriptionEndpointRef.current = currentSub.endpoint;
        } else if (permission === "granted") {
          await subscribeToPush();
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isGuestMode,
    isSupported,
    notificationsEnabled,
    permission,
    getServiceWorkerRegistration,
    sendSubscriptionToBackend,
    subscribeToPush,
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
