import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionMigrationScreen } from "@/components/encryption/EncryptionMigrationScreen";
import { runBackfillMigration } from "@/lib/crypto/backfillMigration";
import { markMigrationComplete } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/backfillMigration", () => ({
  runBackfillMigration: vi.fn(),
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  markMigrationComplete: vi.fn(),
}));

describe("EncryptionMigrationScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the backfill, marks it complete, and calls onComplete", async () => {
    vi.mocked(runBackfillMigration).mockImplementation(
      async (_userId, onProgress) => {
        onProgress?.({ done: 1, total: 2, table: "tasks" });
        onProgress?.({ done: 2, total: 2, table: "tasks" });
      },
    );
    vi.mocked(markMigrationComplete).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(runBackfillMigration).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(markMigrationComplete).toHaveBeenCalledWith("user-1");
  });

  it("shows progress while the pass is running, so a slow pass doesn't look like a hang", async () => {
    let resolveMigration: () => void = () => {};
    vi.mocked(runBackfillMigration).mockImplementation(
      (_userId, onProgress) =>
        new Promise((resolve) => {
          onProgress?.({ done: 3, total: 10, table: "habits" });
          resolveMigration = () => resolve(undefined);
        }),
    );

    render(<EncryptionMigrationScreen userId="user-1" onComplete={vi.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Encrypting habits — 3 of 10/),
      ).toBeInTheDocument(),
    );

    resolveMigration();
  });

  it("shows a retry action and does not mark migration complete when the pass fails", async () => {
    vi.mocked(runBackfillMigration).mockRejectedValue(
      new Error("network dropped"),
    );
    const onComplete = vi.fn();

    render(
      <EncryptionMigrationScreen userId="user-1" onComplete={onComplete} />,
    );

    await waitFor(() =>
      expect(screen.getByText("network dropped")).toBeInTheDocument(),
    );
    expect(markMigrationComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    vi.mocked(runBackfillMigration).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
