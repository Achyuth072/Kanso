"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useChangelogEntries, isNewerThan } from "@/lib/changelog-cache";

interface ChangelogPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appVersion?: string;
  forceVersion?: string;
}

function parseBodyLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^-\s+/, ""))
    .filter(Boolean);
}

export function ChangelogPopup({
  open,
  onOpenChange,
  appVersion = "",
  forceVersion,
}: ChangelogPopupProps) {
  const { entries: displayEntries, loading } = useChangelogEntries(
    open,
    appVersion,
    forceVersion,
  );
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(val) => {
        if (!val) setSelectedCommit(null);
        onOpenChange(val);
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-[520px] border-border/80 shadow-none p-0">
        <ResponsiveDialogHeader className="p-6 pb-3 border-b border-border/80">
          <ResponsiveDialogTitle className="flex items-center gap-2.5 text-[24px] font-semibold tracking-[-0.02em] text-foreground">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            What&apos;s New
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-[11px] font-semibold tracking-[0.01em] text-foreground pt-1">
            {displayEntries.length > 0
              ? `Kanso v${displayEntries[0].version}`
              : "Recent changes"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="max-h-[55vh] overflow-y-auto scrollbar-hide p-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/70" />
            </div>
          )}
          {!loading &&
            displayEntries.map((entry) => (
              <div key={entry.version}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground">
                    v{entry.version}
                  </h3>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {entry.date}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {entry.commits.map((commit) => {
                    const isOpen = selectedCommit === commit.hash;
                    const lines = parseBodyLines(commit.body);
                    return (
                      <div key={commit.hash}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCommit(isOpen ? null : commit.hash)
                          }
                          className="w-full flex items-start gap-2 text-left text-[13px] leading-relaxed tracking-[0.01em] text-foreground font-medium py-1.5 px-3 rounded-md hover:bg-accent/50 transition-seijaku-fast"
                        >
                          <span className="mt-0.5 shrink-0 text-muted-foreground">
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground mr-1.5 shrink-0">
                            {commit.hash}
                          </span>
                          <span className="min-w-0">{commit.heading}</span>
                        </button>
                        {isOpen && lines.length > 0 && (
                          <ul className="ml-8 mt-1 mb-2 space-y-1.5 border-l border-border/50 pl-4">
                            {lines.map((line, i) => (
                              <li
                                key={i}
                                className="text-[13px] leading-relaxed text-foreground/90 font-medium pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[8px] before:h-[2px] before:w-[2px] before:rounded-full before:bg-muted-foreground"
                              >
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          {!loading && displayEntries.length === 0 && (
            <p className="text-[13px] text-muted-foreground text-center py-8 font-medium">
              No changelog entries found.
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export { isNewerThan };
