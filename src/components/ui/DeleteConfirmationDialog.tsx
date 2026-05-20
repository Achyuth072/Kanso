"use client";

import React from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
import { useHaptic } from "@/lib/hooks/useHaptic";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Task",
  description = "Are you sure you want to delete this task? This action cannot be undone.",
}: DeleteConfirmationDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { trigger } = useHaptic();

  // Handle back navigation on mobile to close drawer instead of navigating away
  useBackNavigation(isOpen && !isDesktop, onClose);

  const handleConfirm = () => {
    trigger("thud");
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    trigger("tick");
    onClose();
  };

  if (isDesktop) {
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent aria-describedby="delete-dialog-description">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription id="delete-dialog-description">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
              className="px-6"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose} repositionInputs={false}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="pt-2">
          <Button
            onClick={handleConfirm}
            variant="destructive"
            className="w-full"
          >
            Delete
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full" onClick={handleCancel}>
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
