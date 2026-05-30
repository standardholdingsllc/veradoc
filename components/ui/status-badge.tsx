"use client";

import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  ExternalLink,
  Eye,
  FileEdit,
  FileSearch,
  FileText,
  IdCard,
  Mail,
  PenLine,
  PenTool,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  PACKET_STATUS_CONFIG,
  SIGNER_STATUS_CONFIG,
} from "@/lib/domain/constants";
import type { PacketStatus, SignerStatus } from "@/lib/domain/types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  FileEdit,
  CreditCard,
  Send,
  Users,
  PenLine,
  CheckCircle,
  FileText,
  Scale,
  Eye,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  XCircle,
  Archive,
  RefreshCw,
  Mail,
  ExternalLink,
  UserPlus,
  CheckSquare,
  IdCard,
  BadgeCheck,
  FileSearch,
  PenTool,
  CheckCircle2,
};

const COLOR_TO_VARIANT: Record<string, BadgeVariant> = {
  gray: "muted",
  amber: "warning",
  blue: "info",
  green: "success",
  purple: "info",
  red: "error",
};

function resolveVariant(color: string): BadgeVariant {
  return COLOR_TO_VARIANT[color] ?? "default";
}

export interface StatusBadgeProps {
  status: PacketStatus | SignerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const packetConfig = PACKET_STATUS_CONFIG[status as PacketStatus];
  const signerConfig = SIGNER_STATUS_CONFIG[status as SignerStatus];
  const config = packetConfig ?? signerConfig;

  if (!config) {
    return (
      <Badge variant="muted" className={className}>
        {status.replace(/_/g, " ")}
      </Badge>
    );
  }

  const IconComponent = ICON_MAP[config.iconName] ?? FileText;
  const variant = resolveVariant(config.color);

  return (
    <Badge variant={variant} className={cn("gap-1.5", className)}>
      {IconComponent && <IconComponent className="size-3 shrink-0" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );
}
