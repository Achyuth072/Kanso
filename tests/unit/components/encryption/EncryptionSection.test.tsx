import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionSection } from "@/components/settings/EncryptionSection";
import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGateActions } from "@/components/encryption/EncryptionGate";
import { changePassphrase, reissueRecoveryCode } from "@/lib/crypto/keyManager";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/encryption/EncryptionGate", () => ({
  useEncryptionGateActions: vi.fn(),
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  changePassphrase: vi.fn(),
  reissueRecoveryCode: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

describe("EncryptionSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useEncryptionGateActions).mockReturnValue({
      lock: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("renders nothing for a guest", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "guest" },
      isGuestMode: true,
    } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<EncryptionSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("changes the passphrase and clears the form on success", async () => {
    vi.mocked(changePassphrase).mockResolvedValue(undefined);
    render(<EncryptionSection />);

    fireEvent.change(screen.getByLabelText("Current Passphrase"), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText("New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change passphrase" }));

    await waitFor(() =>
      expect(changePassphrase).toHaveBeenCalledWith(
        "user-1",
        "old passphrase",
        "a sufficiently long new passphrase",
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Current Passphrase")).toHaveValue(""),
    );
  });

  it("will not change the passphrase with the confirmation left blank", () => {
    render(<EncryptionSection />);

    fireEvent.change(screen.getByLabelText("Current Passphrase"), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText("New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });

    const submit = screen.getByRole("button", { name: "Change passphrase" });
    expect(submit).toBeDisabled();

    fireEvent.submit(submit.closest("form")!);
    expect(changePassphrase).not.toHaveBeenCalled();
  });

  it("generates a new recovery code and shows it, requiring confirmation before it can be dismissed", async () => {
    vi.mocked(reissueRecoveryCode).mockResolvedValue(
      "NEWC-ODEA-BCDE-FGHJ-KMNP-QRST-VWXY-ZABC",
    );
    render(<EncryptionSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "Generate new recovery code" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("NEWC-ODEA-BCDE-FGHJ-KMNP-QRST-VWXY-ZABC"),
      ).toBeInTheDocument(),
    );

    const doneButton = screen.getByRole("button", { name: "Done" });
    expect(doneButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(doneButton).not.toBeDisabled();
  });

  it("calls the gate's lock action when Lock Now is clicked", async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useEncryptionGateActions).mockReturnValue({ lock });
    render(<EncryptionSection />);

    fireEvent.click(screen.getByRole("button", { name: "Lock now" }));

    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
  });

  it("shows an error and re-enables the button if locking fails", async () => {
    const lock = vi.fn().mockRejectedValue(new Error("IndexedDB blocked"));
    vi.mocked(useEncryptionGateActions).mockReturnValue({ lock });
    render(<EncryptionSection />);

    fireEvent.click(screen.getByRole("button", { name: "Lock now" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Lock now" }),
      ).not.toBeDisabled(),
    );
  });
});
