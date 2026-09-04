"use client";

import { useState } from "react";
import { Bug, Check, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { useDiagnosticBundle } from "@/lib/hooks/useDiagnosticBundle";
import type { DiagnosticBundle } from "@/lib/diagnostics/collectDiagnosticBundle";
import { SUPPORT_EMAIL } from "@/lib/links";
import { notify } from "@/lib/notify";
import { triggerDownload } from "@/lib/utils/stats-export";

function downloadBundle(json: string) {
  const filename = `kagelin-diagnostic-${new Date().toISOString().split("T")[0]}.json`;
  triggerDownload(filename, json, "application/json");
}

export function DiagnosticExportSettings() {
  const { generateBundle } = useDiagnosticBundle();
  const [generating, setGenerating] = useState(false);
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      setBundle(await generateBundle());
    } catch {
      notify.error("Couldn't generate the diagnostic bundle");
    } finally {
      setGenerating(false);
    }
  };

  const json = bundle ? JSON.stringify(bundle, null, 2) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      notify.error("Couldn't copy — try Download instead.");
      return;
    }
    setCopied(true);
    notify.success("Diagnostic bundle copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-background">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-secondary/30 shrink-0 mt-0.5">
              <Bug className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                Report a Problem
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Generate a diagnostic bundle to attach to a bug report — app
                version, platform, settings, and the structure of your data
                (counts, recurrence rules, ids, timestamps). Never your task,
                habit, event or project text.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </div>

      <ResponsiveDialog
        open={bundle !== null}
        onOpenChange={(open) => !open && setBundle(null)}
      >
        <ResponsiveDialogContent className="sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="type-h2">
              Diagnostic Bundle
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Review what&apos;s in the bundle before sending it. If the problem
              needs your actual data to reproduce, export a{" "}
              <strong>Backup</strong> separately and attach that too.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border/40 bg-secondary/20 p-3 text-xs whitespace-pre-wrap break-all">
            {json}
          </pre>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => downloadBundle(json)}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-1">
            Attach the file to a{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline underline-offset-2 hover:text-foreground"
            >
              support email
            </a>{" "}
            or a GitHub issue.
          </p>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
