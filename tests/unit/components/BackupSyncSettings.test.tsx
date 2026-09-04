import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";
import { useUiStore } from "@/lib/store/uiStore";

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    "aria-label": ariaLabel,
  }: {
    checked: boolean;
    onCheckedChange: (c: boolean) => void;
    "aria-label"?: string;
  }) => (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      aria-label={ariaLabel}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    children: ReactNode;
  }) => (
    <select
      aria-label="Reminder frequency"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

const useAuthMock = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useAccountData", () => ({
  useAccountData: () => ({ exportData: vi.fn(), importData: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ImportDialog pulls in habit-import mutations that need a real
// QueryClientProvider; irrelevant to the tab-gating behavior under test.
vi.mock("@/components/settings/ImportDialog", () => ({
  ImportDialog: () => null,
}));

describe("BackupSyncSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReset();
    useUiStore.setState({
      backupReminderEnabled: true,
      backupReminderFrequencyDays: 7,
    });
  });

  it("shows the WebDAV tab for guests too", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    expect(screen.getByText("Local Storage")).toBeInTheDocument();
    expect(screen.getByText("WebDAV")).toBeInTheDocument();
  });

  it("shows the WebDAV tab for registered users", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(screen.getByText("Local Storage")).toBeInTheDocument();
    expect(screen.getByText("WebDAV")).toBeInTheDocument();
  });

  it("never writes WebDAV credentials to localStorage", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(localStorage.getItem("kanso_webdav_credentials")).toBeNull();
  });

  it("shows the Backup Reminders card for guests", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    expect(screen.getByText("Backup Reminders")).toBeInTheDocument();
  });

  it("hides the Backup Reminders card for registered users", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(screen.queryByText("Backup Reminders")).not.toBeInTheDocument();
  });

  it("warns registered users that the Local Backup file leaves the encrypted envelope", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(
      screen.getByText(/not covered by your content passphrase/i),
    ).toBeInTheDocument();
  });

  it("does not show the envelope warning for guests, who have no passphrase", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    expect(
      screen.queryByText(/not covered by your content passphrase/i),
    ).not.toBeInTheDocument();
  });

  it("warns registered users on the WebDAV tab too", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    fireEvent.click(screen.getByRole("tab", { name: /webdav/i }));

    expect(
      screen.getAllByText(/not covered by your content passphrase/i).length,
    ).toBeGreaterThan(0);
  });

  it("toggling the Switch updates backupReminderEnabled in the store", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    const toggle = screen.getByRole("switch", {
      name: "Remind me to back up",
    });
    fireEvent.click(toggle);

    expect(useUiStore.getState().backupReminderEnabled).toBe(false);
  });

  it("changing the frequency Select updates backupReminderFrequencyDays in the store", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    const select = screen.getByLabelText("Reminder frequency");
    fireEvent.change(select, { target: { value: "30" } });

    expect(useUiStore.getState().backupReminderFrequencyDays).toBe(30);
  });

  it("persists toggled reminder preferences to storage across a reload", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    fireEvent.click(
      screen.getByRole("switch", { name: "Remind me to back up" }),
    );
    fireEvent.change(screen.getByLabelText("Reminder frequency"), {
      target: { value: "30" },
    });

    const persisted = JSON.parse(
      localStorage.getItem("kanso-ui-state") ?? "{}",
    );
    expect(persisted.state.backupReminderEnabled).toBe(false);
    expect(persisted.state.backupReminderFrequencyDays).toBe(30);
  });
});
