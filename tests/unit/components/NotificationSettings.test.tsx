import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useProfile } from "@/lib/hooks/useProfile";
import { useAuth } from "@/components/AuthProvider";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { sendPushNotification } from "@/lib/push-api";
import React from "react";

vi.mock("@/lib/hooks/usePushNotifications");
vi.mock("@/lib/hooks/useProfile");
vi.mock("@/components/AuthProvider");
vi.mock("@/lib/hooks/useHaptic");
vi.mock("@/lib/push-api", () => ({
  sendPushNotification: vi.fn(),
}));

describe("NotificationSettings Component", () => {
  const mockUpdateSettings = { mutateAsync: vi.fn() };
  const mockUpdateProfile = { mutate: vi.fn() };
  const mockRequestPermission = vi.fn();
  const mockSubscribeToPush = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeToPush.mockResolvedValue({
      endpoint: "https://current-device.test",
    });

    (usePushNotifications as Mock).mockReturnValue({
      isSupported: true,
      permission: "granted",
      notificationsEnabled: true,
      subscription: { endpoint: "https://current-device.test" },
      isSyncing: false,
      requestPermission: mockRequestPermission,
      subscribeToPush: mockSubscribeToPush,
      unsubscribe: mockUnsubscribe,
    });

    (useProfile as Mock).mockReturnValue({
      profile: {
        timezone: "UTC",
        settings: {
          notifications: {
            morning_briefing: true,
            evening_plan: true,
            due_date_alerts: true,
            do_date_alerts: true,
            timer_alerts: true,
          },
        },
      },
      updateSettings: mockUpdateSettings,
      updateProfile: mockUpdateProfile,
    });

    (useAuth as Mock).mockReturnValue({ isGuestMode: false });
    (useHaptic as Mock).mockReturnValue({ trigger: vi.fn() });
    vi.mocked(sendPushNotification).mockResolvedValue({
      success: true,
      sentCount: 1,
      failedCount: 0,
      endpointMatched: true,
    });
  });

  it("TC-NS-01: should render all notification toggles and timezone picker", () => {
    render(<NotificationSettings />);

    expect(screen.getByText(/Push Notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm your timezone/i)).toBeInTheDocument();
    expect(screen.getByText("Morning Briefing")).toBeInTheDocument();
    expect(screen.getByText("Evening Plan")).toBeInTheDocument();
  });

  it("TC-NS-02: should call updateSettings when a toggle is changed", () => {
    render(<NotificationSettings />);

    const briefingToggle = screen.getByLabelText(/Morning Briefing/i);
    fireEvent.click(briefingToggle);

    expect(mockUpdateSettings.mutateAsync).toHaveBeenCalled();
  });

  it("TC-NS-03: should send the test notification to the current subscription endpoint", async () => {
    render(<NotificationSettings />);

    const testBtn = screen.getByRole("button", {
      name: /Send Test Notification \(Server\)/i,
    });
    fireEvent.click(testBtn);

    await waitFor(
      () => {
        expect(sendPushNotification).toHaveBeenCalledWith({
          endpoint: "https://current-device.test",
          title: "Test Notification",
          body: "This is a server-sent test notification from Kanso",
          data: { type: "test" },
        });
      },
      { timeout: 3000 },
    );
  });

  it("TC-NS-04: should show guest mode warning when permission is granted", () => {
    (useAuth as Mock).mockReturnValue({ isGuestMode: true });
    render(<NotificationSettings />);

    expect(
      screen.getByText(/Server-side alerts require a synced account/i),
    ).toBeInTheDocument();
  });

  it("TC-NS-05: should show not supported message when browser doesn't support push", () => {
    (usePushNotifications as Mock).mockReturnValue({
      isSupported: false,
      permission: "default",
    });
    render(<NotificationSettings />);

    expect(
      screen.getByText(/Notifications Not Supported/i),
    ).toBeInTheDocument();
  });
});
