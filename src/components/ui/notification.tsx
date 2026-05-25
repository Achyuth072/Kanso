"use client";

import { Toaster as SonnerToaster } from "sonner";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      expand={true}
      duration={4000}
      style={{ zIndex: 50 }}
      mobileOffset={{ left: 16, right: 16, bottom: 16 }}
      swipeDirections={["bottom"]}
      toastOptions={{
        unstyled: true,
        style: {
          // max-content (not fit-content): fit-content shrinks to min-content (longest word) inside Sonner's absolute-positioned <li>, causing mid-word wrap on short messages. max-content sizes to the natural one-line width; existing maxWidth caps long messages.
          width: "max-content",
          maxWidth: "min(24rem, calc(100vw - 2rem))",
        },
        classNames: {
          toast: cn(
            inter.variable,
            "font-sans",
            "bg-card/98 backdrop-blur-md border border-border/80 text-foreground",
            "rounded-md shadow-sm inline-flex items-center gap-3",
            "py-2.5 px-4 sm:py-3 sm:px-5",
            "w-fit max-w-sm",
            "mb-[calc(76px+env(safe-area-inset-bottom))] md:mb-5",
            "transition-all duration-300 ease-seijaku",
            "[&_[data-icon]]:text-foreground/60",
          ),
          icon: "shrink-0 [&>svg]:w-5 [&>svg]:h-5",
          content: "min-w-0 flex-1",
          title:
            "font-semibold text-[13px] sm:text-sm tracking-tight leading-tight",
          description:
            "text-[12px] sm:text-sm text-muted-foreground leading-normal",
          error: cn("[&_[data-icon]]:text-destructive"),
          actionButton: cn(
            "bg-primary text-primary-foreground h-8 px-3 rounded-sm",
            "font-semibold text-[12px] sm:text-sm tracking-tight",
            "hover:opacity-90 active:scale-[0.98] transition-all shrink-0 shadow-sm",
            "ml-auto sm:ml-0 whitespace-nowrap",
          ),
          cancelButton: cn(
            "bg-transparent border border-border text-muted-foreground h-8 px-3 rounded-sm",
            "text-[12px] sm:text-sm hover:bg-accent shrink-0 ml-auto sm:ml-0 whitespace-nowrap",
          ),
        },
      }}
    />
  );
}
