import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionSection } from "@/components/settings/EncryptionSection";
import { useAuth } from "@/components/AuthProvider";
import { changePassphrase, reissueRecoveryCode } from "@/lib/crypto/keyManager";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
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
});
