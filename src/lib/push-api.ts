/**
 * Frontend utility functions for interacting with Push Notification API routes.
 */

export async function syncPushSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to sync push subscription");
  }

  return response.json();
}

export async function removePushSubscription(endpoint: string) {
  const response = await fetch(
    `/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to remove push subscription");
  }

  return response.json();
}

export interface SendPushParams {
  userId?: string;
  endpoint?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SendPushResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  endpointMatched?: boolean;
}

export async function sendPushNotification(params: SendPushParams) {
  const response = await fetch("/api/push/send", {
    method: "POST",
    body: JSON.stringify(params),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      errorData.error ||
      `Failed to send push notification (${response.status})`;
    console.error("Push API Error:", errorMessage);
    throw new Error(errorMessage);
  }

  return (await response.json()) as SendPushResult;
}
