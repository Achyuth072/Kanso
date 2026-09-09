"use client";

import { useRef } from "react";
import { format } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { BetaBadge } from "@/components/ui/beta-badge";
import { Database, Loader2, Calendar, FileUp } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { useIcsImport, ICS_CONFIRM_THRESHOLD } from "@/lib/hooks/useIcsImport";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const { trigger } = useHaptic();

  const { importUhabits, isImporting: isImportingUhabits } = useUhabitsImport();
  const {
    prepareImport,
    commitImport,
    cancelImport,
    preview,
    isImporting: isImportingIcs,
  } = useIcsImport();

  const handleImportUhabits = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const success = await importUhabits(file);
    if (success) onOpenChange(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportIcs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await prepareImport(file);
    if (icsInputRef.current) icsInputRef.current.value = "";
    if (!result) return;
    if (result.toCreate.length < ICS_CONFIRM_THRESHOLD) {
      const success = await commitImport(result);
      if (success) onOpenChange(false);
    }
  };

  const handleConfirmIcsImport = async () => {
    trigger("toggle");
    const success = await commitImport();
    if (success) onOpenChange(false);
  };

  const handleCancelIcsImport = () => {
    trigger("tick");
    cancelImport();
  };

  const isAnyImporting = isImportingUhabits || isImportingIcs;

  if (preview) {
    const dateRange =
      preview.earliest && preview.latest
        ? preview.earliest === preview.latest
          ? format(new Date(preview.earliest), "MMM d, yyyy")
          : `${format(new Date(preview.earliest), "MMM d, yyyy")} – ${format(new Date(preview.latest), "MMM d, yyyy")}`
        : null;

    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancelImport();
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[425px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="type-h2">
              Confirm Import
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              This is a large import — review before adding it to your calendar.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="px-4 py-4 sm:px-0">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Events found</dt>
                <dd>{preview.totalParsed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">New events</dt>
                <dd>{preview.toCreate.length}</dd>
              </div>
              {preview.duplicateCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Duplicates skipped</dt>
                  <dd>{preview.duplicateCount}</dd>
                </div>
              )}
              {dateRange && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Date range</dt>
                  <dd>{dateRange}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={handleCancelIcsImport}
              className="text-muted-foreground hover:text-foreground"
              disabled={isImportingIcs}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmIcsImport} disabled={isImportingIcs}>
              {isImportingIcs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Import ${preview.toCreate.length} events`
              )}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="type-h2">
            Import Data
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a file to migrate your data to Kagelin.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-4 py-4 sm:px-0">
          <div className="space-y-4">
            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                fileInputRef.current?.click();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-brand/10 text-brand">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    Loop Habit Tracker
                    <BetaBadge />
                  </p>
                  <p className="text-xs text-muted-foreground lowercase">
                    Import from .db file (Android)
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isAnyImporting}
                aria-label="Select Loop Habit Tracker database file"
              >
                {isImportingUhabits ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Select"
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                className="hidden"
                aria-label="Upload Loop Habit Tracker database file"
                onChange={handleImportUhabits}
              />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                icsInputRef.current?.click();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-brand/10 text-brand">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">ICS (Calendar)</p>
                  <p className="text-xs text-muted-foreground lowercase">
                    Import to Calendar
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 opacity-0 group-hover:opacity-100 transition-opacity text-brand"
                disabled={isAnyImporting}
                aria-label="Select iCalendar ICS file"
              >
                {isImportingIcs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
              </Button>
              <input
                ref={icsInputRef}
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                aria-label="Upload iCalendar ICS file"
                onChange={handleImportIcs}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            disabled={isAnyImporting}
          >
            Cancel
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
