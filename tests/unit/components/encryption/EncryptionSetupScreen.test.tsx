import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionSetupScreen } from "@/components/encryption/EncryptionSetupScreen";
import { setupEncryption } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/keyManager", () => ({
  setupEncryption: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const RECOVERY_CODE = "ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567-89AB";

function fillPassphrase(passphrase: string, confirm = passphrase) {
  fireEvent.change(screen.getByLabelText("Passphrase"), {
    target: { value: passphrase },
  });
  fireEvent.change(screen.getByLabelText("Confirm passphrase"), {
    target: { value: confirm },
  });
}

describe("EncryptionSetupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("states plainly what is and isn't protected, and the both-lost warning, before any input", () => {
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);

    expect(screen.getByText(/Protected:/)).toBeInTheDocument();
    expect(screen.getByText(/Not protected:/)).toBeInTheDocument();
    expect(screen.getByText(/data is unrecoverable/i)).toBeInTheDocument();
  });

  it("disables submit until the passphrase clears the minimum length", () => {
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Set passphrase" });

    fillPassphrase("short");
    expect(submit).toBeDisabled();

    fillPassphrase("a sufficiently long passphrase");
    expect(submit).not.toBeDisabled();
  });

  it("disables submit and shows an error when the confirmation doesn't match", () => {
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);
    fillPassphrase("a sufficiently long passphrase", "something else entirely");

    expect(screen.getByText("Passphrases don't match.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set passphrase" }),
    ).toBeDisabled();
  });

  it("will not set up encryption with the confirmation left blank", () => {
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);
    fillPassphrase("a sufficiently long passphrase", "");

    const submit = screen.getByRole("button", { name: "Set passphrase" });
    expect(submit).toBeDisabled();

    fireEvent.submit(submit.closest("form")!);
    expect(setupEncryption).not.toHaveBeenCalled();
  });

  it("warns on a weak passphrase without blocking submission", () => {
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);
    fillPassphrase("aaaaaaaaaaaaaaaa");

    expect(screen.getByText(/easy to guess/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set passphrase" }),
    ).not.toBeDisabled();
  });

  it("moves to the recovery-code step on success, and only continues once saved is confirmed", async () => {
    vi.mocked(setupEncryption).mockResolvedValue({
      recoveryCode: RECOVERY_CODE,
    });
    const onComplete = vi.fn();
    render(<EncryptionSetupScreen userId="user-1" onComplete={onComplete} />);

    fillPassphrase("a sufficiently long passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Set passphrase" }));

    await waitFor(() =>
      expect(screen.getByText(RECOVERY_CODE)).toBeInTheDocument(),
    );
    expect(setupEncryption).toHaveBeenCalledWith(
      "user-1",
      "a sufficiently long passphrase",
    );

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);
    expect(onComplete).toHaveBeenCalled();
  });

  it("shows an error and stays on the passphrase step if setup fails", async () => {
    vi.mocked(setupEncryption).mockRejectedValue(new Error("network down"));
    render(<EncryptionSetupScreen userId="user-1" onComplete={vi.fn()} />);

    fillPassphrase("a sufficiently long passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Set passphrase" }));

    await waitFor(() =>
      expect(screen.getByText("network down")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Set passphrase" }),
    ).toBeInTheDocument();
  });
});
