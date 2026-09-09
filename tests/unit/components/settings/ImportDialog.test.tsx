import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ImportDialog } from "@/components/settings/ImportDialog";
import type { IcsImportPreview } from "@/lib/hooks/useIcsImport";

const { prepareImportMock, commitImportMock, cancelImportMock } = vi.hoisted(
  () => ({
    prepareImportMock: vi.fn(),
    commitImportMock: vi.fn(),
    cancelImportMock: vi.fn(),
  }),
);

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useUhabitsImport", () => ({
  useUhabitsImport: () => ({ importUhabits: vi.fn(), isImporting: false }),
}));

vi.mock("@/lib/hooks/useIcsImport", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/hooks/useIcsImport")>();
  return {
    ...actual,
    useIcsImport: () => {
      const [preview, setPreview] = useState<IcsImportPreview | null>(null);
      return {
        prepareImport: async (file: File) => {
          const result = await prepareImportMock(file);
          setPreview(result);
          return result;
        },
        commitImport: async (target?: IcsImportPreview | null) => {
          const success = await commitImportMock(target ?? preview);
          setPreview(null);
          return success;
        },
        cancelImport: () => {
          cancelImportMock();
          setPreview(null);
        },
        preview,
        isImporting: false,
      };
    },
  };
});

function makePreview(
  overrides: Partial<IcsImportPreview> = {},
): IcsImportPreview {
  return {
    toCreate: [],
    totalParsed: 0,
    duplicateCount: 0,
    earliest: null,
    latest: null,
    parseErrors: [],
    ...overrides,
  };
}

describe("ImportDialog — ICS confirmation step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commitImportMock.mockResolvedValue(true);
  });

  it("commits immediately for a small import — no confirmation shown", async () => {
    prepareImportMock.mockResolvedValue(
      makePreview({ toCreate: [{}] as never, totalParsed: 1 }),
    );
    const onOpenChange = vi.fn();
    render(<ImportDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "small.ics")] },
    });

    await waitFor(() => expect(commitImportMock).toHaveBeenCalled());
    expect(screen.queryByText("Confirm Import")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a confirmation step for a large import and waits for the user", async () => {
    const bigToCreate = Array.from({ length: 60 }, () => ({}) as never);
    prepareImportMock.mockResolvedValue(
      makePreview({
        toCreate: bigToCreate,
        totalParsed: 63,
        duplicateCount: 3,
      }),
    );
    render(<ImportDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "big.ics")] },
    });

    await screen.findByText("Confirm Import");
    expect(commitImportMock).not.toHaveBeenCalled();
    expect(screen.getByText("63")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Import 60 events"));
    await waitFor(() => expect(commitImportMock).toHaveBeenCalled());
  });

  it("cancel on the confirmation step writes nothing", async () => {
    const bigToCreate = Array.from({ length: 60 }, () => ({}) as never);
    prepareImportMock.mockResolvedValue(
      makePreview({ toCreate: bigToCreate, totalParsed: 60 }),
    );
    render(<ImportDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload iCalendar ICS file"), {
      target: { files: [new File(["x"], "big.ics")] },
    });
    await screen.findByText("Confirm Import");

    fireEvent.click(screen.getByText("Cancel"));
    expect(cancelImportMock).toHaveBeenCalled();
    expect(commitImportMock).not.toHaveBeenCalled();
  });
});
