"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { truncateHash } from "@/lib/formatters";
import { ACTIONS, TOAST } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

interface HashDisplayProps {
  hash: string;
  truncateChars?: number;
  className?: string;
}

export function HashDisplay({
  hash,
  truncateChars = 8,
  className,
}: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success(TOAST.copiadoPortapapeles);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(TOAST.errorGenerico);
    }
  }, [hash]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <code
        className="rounded border border-border bg-surface px-2 py-1 font-mono text-xs text-foreground"
        title={hash}
      >
        {truncateHash(hash, truncateChars)}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={handleCopy}
        aria-label={ACTIONS.copiarHashCompleto}
      >
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
