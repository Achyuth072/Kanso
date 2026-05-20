import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoaderOverlayProps {
  message?: string;
  className?: string;
}

export function LoaderOverlay({
  message = "Loading...",
  className,
}: LoaderOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 bg-background/80 backdrop-blur-sm z-50",
        "flex flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
