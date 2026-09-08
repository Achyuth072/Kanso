import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnlockScreen } from "@/components/encryption/UnlockScreen";
import {
  unlockWithPassphrase,
  unlockWithRecoveryCode,
} from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/keyManager", () => ({
  unlockWithPassphrase: vi.fn(),
  unlockWithRecoveryCode: vi.fn(),
}));

describe("UnlockScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unlocks with a passphrase by default", async () => {
    vi.mocked(unlockWithPassphrase).mockResolvedValue(new Uint8Array([1]));
    const onUnlocked = vi.fn();
    render(<UnlockScreen userId="user-1" onUnlocked={onUnlocked} />);

    fireEvent.change(screen.getByLabelText("Passphrase"), {
      target: { value: "my passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(unlockWithPassphrase).toHaveBeenCalledWith(
      "user-1",
      "my passphrase",
    );
    expect(unlockWithRecoveryCode).not.toHaveBeenCalled();
  });

  it("switches to recovery-code mode and unlocks with it instead", async () => {
    vi.mocked(unlockWithRecoveryCode).mockResolvedValue(new Uint8Array([1]));
    const onUnlocked = vi.fn();
    render(<UnlockScreen userId="user-1" onUnlocked={onUnlocked} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Use my recovery code instead" }),
    );
    fireEvent.change(screen.getByLabelText("Recovery code"), {
      target: { value: "ABCD-EFGH" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
    expect(unlockWithRecoveryCode).toHaveBeenCalledWith("user-1", "ABCD-EFGH");
    expect(unlockWithPassphrase).not.toHaveBeenCalled();
  });

  it("shows an error and doesn't call onUnlocked when the passphrase is wrong", async () => {
    vi.mocked(unlockWithPassphrase).mockRejectedValue(
      new Error("That passphrase isn't right."),
    );
    const onUnlocked = vi.fn();
    render(<UnlockScreen userId="user-1" onUnlocked={onUnlocked} />);

    fireEvent.change(screen.getByLabelText("Passphrase"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() =>
      expect(
        screen.getByText("That passphrase isn't right."),
      ).toBeInTheDocument(),
    );
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
