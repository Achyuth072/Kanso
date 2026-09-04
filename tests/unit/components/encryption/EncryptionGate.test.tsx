import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EncryptionGate,
  useEncryptionGateActions,
} from "@/components/encryption/EncryptionGate";
import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import type { EncryptionGateStatus } from "@/lib/hooks/useEncryptionGate";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/hooks/useEncryptionGate", () => ({
  useEncryptionGate: vi.fn(),
}));

vi.mock("@/components/encryption/EncryptionSetupScreen", () => ({
  EncryptionSetupScreen: () => <div>setup-screen</div>,
}));

vi.mock("@/components/encryption/UnlockScreen", () => ({
  UnlockScreen: () => <div>unlock-screen</div>,
}));

vi.mock("@/components/encryption/EncryptionMigrationScreen", () => ({
  EncryptionMigrationScreen: () => <div>migration-screen</div>,
}));

function mockGate(status: EncryptionGateStatus, lock = vi.fn()) {
  vi.mocked(useEncryptionGate).mockReturnValue({
    status,
    recheck: vi.fn(),
    lock,
  });
}

function LockButton() {
  const { lock } = useEncryptionGateActions();
  return <button onClick={() => void lock()}>lock-from-descendant</button>;
}

describe("EncryptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders children once unlocked", () => {
    mockGate("unlocked");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("app-content")).toBeInTheDocument();
  });

  it("renders children for a guest regardless of gate status", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "guest" },
      isGuestMode: true,
    } as unknown as ReturnType<typeof useAuth>);
    mockGate("needs-setup");

    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("app-content")).toBeInTheDocument();
  });

  it("renders the setup screen and withholds children when a key hasn't been set up", () => {
    mockGate("needs-setup");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("setup-screen")).toBeInTheDocument();
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("renders the unlock screen and withholds children when the device has no cached key", () => {
    mockGate("needs-unlock");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("unlock-screen")).toBeInTheDocument();
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("renders the migration screen and withholds children when unlocked but not yet backfilled", () => {
    mockGate("needs-migration");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("migration-screen")).toBeInTheDocument();
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("withholds children while resolving gate status", () => {
    mockGate("loading");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("offers a retry instead of an endless spinner when the status check fails", () => {
    const recheck = vi.fn();
    vi.mocked(useEncryptionGate).mockReturnValue({
      status: "unavailable",
      recheck,
      lock: vi.fn(),
    });

    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );

    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(recheck).toHaveBeenCalledTimes(1);
  });

  it("gives unlocked descendants a lock action that reaches the hook's lock", () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    mockGate("unlocked", lock);
    render(
      <EncryptionGate>
        <LockButton />
      </EncryptionGate>,
    );

    fireEvent.click(screen.getByText("lock-from-descendant"));
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("throws when a component outside an unlocked gate asks for lock actions", () => {
    // Suppress the expected React error-boundary console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<LockButton />)).toThrow(
      "useEncryptionGateActions must be used within an unlocked EncryptionGate",
    );
    spy.mockRestore();
  });

  it("switches from children to the unlock screen once lock resolves", async () => {
    let resolveLock: () => void = () => {};
    const lock = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLock = resolve;
        }),
    );
    mockGate("unlocked", lock);
    const { rerender } = render(
      <EncryptionGate>
        <LockButton />
      </EncryptionGate>,
    );

    fireEvent.click(screen.getByText("lock-from-descendant"));
    resolveLock();
    await waitFor(() => expect(lock).toHaveBeenCalled());

    mockGate("needs-unlock", lock);
    rerender(
      <EncryptionGate>
        <LockButton />
      </EncryptionGate>,
    );

    expect(screen.getByText("unlock-screen")).toBeInTheDocument();
    expect(screen.queryByText("lock-from-descendant")).not.toBeInTheDocument();
  });
});
