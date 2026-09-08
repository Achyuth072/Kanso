"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { notify } from "@/lib/notify";
import { triggerDownload } from "@/lib/utils/stats-export";

function downloadRecoveryCode(code: string) {
  triggerDownload(
    "kagelin-recovery-code.txt",
    `Kagelin recovery code\n\n${code}\n\nThis code, or your passphrase, is the only way to unlock your data. Kagelin cannot recover it for you if both are lost.\n`,
    "text/plain",
  );
}
export function RecoveryCodeDisplay({
  recoveryCode,
  onContinue,
  continueLabel = "Continue",
}: {
  recoveryCode: string;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
    } catch {
      notify.error("Couldn't copy — try Download instead.");
      return;
    }
    setCopied(true);
    notify.success("Recovery code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-5">
      <div className="font-mono text-sm sm:text-base text-center tracking-wider bg-secondary/30 border border-border rounded-lg p-4 break-all select-all">
        {recoveryCode}
      </div>

      <div className="flex gap-2">
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
          onClick={() => downloadRecoveryCode(recoveryCode)}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      <label className="flex items-start gap-2.5 text-sm cursor-pointer">
        <Checkbox
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
          className="mt-0.5"
        />
        <span>
          I&apos;ve saved this recovery code somewhere safe, separate from my
          passphrase.
        </span>
      </label>

      <Button
        type="button"
        className="w-full h-11 text-base font-medium"
        disabled={!saved}
        onClick={onContinue}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
