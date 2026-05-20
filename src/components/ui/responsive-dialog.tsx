"use client";

import * as React from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

interface ResponsiveDialogDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Handle back navigation on mobile to close drawer instead of navigating away
  useBackNavigation(isMobile && open, () => onOpenChange(false));

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile }}>
        <Drawer
          open={open}
          onOpenChange={onOpenChange}
          repositionInputs={false}
        >
          {children}
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

export function ResponsiveDialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: ResponsiveDialogContentProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerContent
        className={className}
        overlayClassName={overlayClassName}
        {...props}
      >
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      className={className}
      overlayClassName={overlayClassName}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({
  className,
  children,
}: ResponsiveDialogHeaderProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogTitle({
  className,
  children,
  ...props
}: ResponsiveDialogTitleProps & React.HTMLAttributes<HTMLHeadingElement>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerTitle className={className} {...props}>
        {children}
      </DrawerTitle>
    );
  }

  return (
    <DialogTitle className={className} {...props}>
      {children}
    </DialogTitle>
  );
}

export function ResponsiveDialogDescription({
  className,
  children,
  ...props
}: ResponsiveDialogDescriptionProps &
  React.HTMLAttributes<HTMLParagraphElement>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);

  if (isMobile) {
    return (
      <DrawerDescription className={className} {...props}>
        {children}
      </DrawerDescription>
    );
  }

  return (
    <DialogDescription className={className} {...props}>
      {children}
    </DialogDescription>
  );
}
