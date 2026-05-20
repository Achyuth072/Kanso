/**
 * Frontend utility functions for interacting with Timer Notification API routes.
 */

export interface ScheduleTimerParams {
  duration: number; // in seconds
  taskId?: string | null;
  mode: "focus" | "shortBreak" | "longBreak";
}

export async function scheduleTimerNotification(params: ScheduleTimerParams) {
  const response = await fetch("/api/timer/start", {
    method: "POST",
    body: JSON.stringify(params),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to schedule timer notification");
  }

  return response.json();
}

export async function cancelTimerNotification(notificationId: string) {
  const response = await fetch("/api/timer/start", {
    method: "DELETE",
    body: JSON.stringify({ notificationId }),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to cancel timer notification");
  }

  return response.json();
}
