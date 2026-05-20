"use client";

import { useRef } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Database, Loader2, Calendar, FileUp } from "lucide-react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useUhabitsImport } from "@/lib/hooks/useUhabitsImport";
import { useIcsImport } from "@/lib/hooks/useIcsImport";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const { trigger } = useHaptic();

  const { importUhabits, isImporting: isImportingUhabits } = useUhabitsImport();
  const { importIcs, isImporting: isImportingIcs } = useIcsImport();

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
    const success = await importIcs(file);
    if (success) onOpenChange(false);
    if (icsInputRef.current) icsInputRef.current.value = "";
  };

  const isAnyImporting = isImportingUhabits || isImportingIcs;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="type-h2">
            Import Data
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a file to migrate your data to Kanso.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4">
          <div className="space-y-4">
            {/* UHabits Import */}
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
                  <p className="text-sm font-medium">Loop Habit Tracker</p>
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
                onChange={handleImportUhabits}
              />
            </div>

            {/* ICS Import */}
            <div
              className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-all cursor-pointer group"
              onClick={() => {
                trigger("toggle");
                icsInputRef.current?.click();
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
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
                className="h-8 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600"
                disabled={isAnyImporting}
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
