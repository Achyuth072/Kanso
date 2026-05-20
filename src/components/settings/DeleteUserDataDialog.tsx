"use client";

import { useState, useEffect } from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

interface DeleteUserDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteUserDataDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteUserDataDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { trigger } = useHaptic();
  const { isGuestMode } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const isMatch = confirmText.toLowerCase() === "delete";

  // Handle back navigation on mobile
  useBackNavigation(open && !isDesktop, () => onOpenChange(false));

  // Reset state when dialog opens or closes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setConfirmText("");
    }
  }

  // Haptic on open
  useEffect(() => {
    if (open) {
      trigger("thud");
    }
  }, [open, trigger]);

  const handleConfirm = () => {
    if (!isMatch) return;
    onConfirm();
    onOpenChange(false);
  };

  const title = isGuestMode ? "Delete All Data" : "Delete Cloud Data";
  const description = isGuestMode
    ? "This action is permanent and cannot be undone. All your local habits, tasks, and settings will be permanently erased."
    : "This action is permanent and cannot be undone. All your habits, tasks, and cloud settings will be permanently erased from our servers.";

  const content = (
    <div className="space-y-4 py-2">
      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-foreground/90 font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-1">
          Type <span className="text-foreground">delete</span> to confirm
        </label>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type 'delete'..."
          className="h-11 bg-secondary/30 border-border/50 focus:border-destructive/30 focus:ring-destructive/10 transition-all font-medium"
          autoFocus={isDesktop}
        />
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </AlertDialogHeader>
          {content}
          <AlertDialogFooter className="mt-6 flex gap-2">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                onClick={() => {
                  trigger("tick");
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isMatch}
              className="gap-2 px-6 font-semibold shadow-none disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              Delete Account Data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">{content}</div>
          <DrawerFooter className="flex flex-col gap-2 pt-2 pb-8">
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isMatch}
              className="w-full gap-3 active:scale-95 h-12 text-base font-semibold shadow-none disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
              Permanently Delete Data
            </Button>
            <DrawerClose asChild>
              <Button
                variant="outline"
                className="w-full h-12 text-muted-foreground"
                onClick={() => trigger("tick")}
              >
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
